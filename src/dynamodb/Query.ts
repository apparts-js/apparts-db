import {
  BatchGetCommand,
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  ScanCommandInput,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  Filter,
  GenericQuery,
  Id,
  NotSupportedByDBEngine,
  Order,
  Params,
  Result,
} from "../generic";
import { DynamoConfig } from "./Config";
import { LogFunc } from "./types";

type QueryState = {
  params: Params;
  limit?: number;
  offset?: number;
  order?: Order;
};

type FilterExpr = {
  expr: string;
  attrNames: Record<string, string>;
  attrValues: Record<string, unknown>;
};

const PK = "id";

const namePlaceholder = (
  attr: string,
  attrNames: Record<string, string>
): string => {
  const key = `#n${Object.keys(attrNames).length}`;
  attrNames[key] = attr;
  return key;
};

const valuePlaceholder = (
  value: unknown,
  attrValues: Record<string, unknown>
): string => {
  const key = `:v${Object.keys(attrValues).length}`;
  attrValues[key] = value;
  return key;
};

const buildOperator = (
  attr: string,
  op: string,
  val: unknown,
  attrNames: Record<string, string>,
  attrValues: Record<string, unknown>
): string => {
  const n = namePlaceholder(attr, attrNames);
  switch (op) {
    case "exists":
      return `${
        val === true ? "attribute_exists" : "attribute_not_exists"
      }(${n})`;
    case "in": {
      const vals = val as (string | number | boolean | null)[];
      if (vals.length === 0) return "1 = 0";
      const placeholders = vals.map((v) => valuePlaceholder(v, attrValues));
      return `${n} IN (${placeholders.join(", ")})`;
    }
    case "notin": {
      const vals = val as (string | number | boolean | null)[];
      if (vals.length === 0) return "1 = 1";
      const placeholders = vals.map((v) => valuePlaceholder(v, attrValues));
      return `NOT (${n} IN (${placeholders.join(", ")}))`;
    }
    case "lte":
      return `${n} <= ${valuePlaceholder(val, attrValues)}`;
    case "lt":
      return `${n} < ${valuePlaceholder(val, attrValues)}`;
    case "gte":
      return `${n} >= ${valuePlaceholder(val, attrValues)}`;
    case "gt":
      return `${n} > ${valuePlaceholder(val, attrValues)}`;
    case "and": {
      const parts = (val as { op: string; val: unknown }[]).map((v) =>
        buildOperator(attr, v.op, v.val, attrNames, attrValues)
      );
      return `(${parts.join(" AND ")})`;
    }
    case "like":
    case "ilike":
      throw new NotSupportedByDBEngine(
        `Query filter operator "${op}" is not supported by DynamoDB.`
      );
    case "of":
      throw new NotSupportedByDBEngine(
        `Query filter operator "of" (nested JSON path) is not supported by DynamoDB.`
      );
    case "oftype":
      throw new NotSupportedByDBEngine(
        `Query filter operator "oftype" is not supported by DynamoDB.`
      );
    default:
      throw new NotSupportedByDBEngine(
        `Query filter operator "${op}" is not supported by DynamoDB.`
      );
  }
};

const buildFilterExpression = (params: Params): FilterExpr => {
  const attrNames: Record<string, string> = {};
  const attrValues: Record<string, unknown> = {};
  const keys = Object.keys(params);
  if (keys.length === 0) {
    return { expr: "", attrNames, attrValues };
  }
  const clauses = keys.map((key) => {
    const val = params[key];
    if (val === null) {
      const n = namePlaceholder(key, attrNames);
      return `attribute_not_exists(${n})`;
    }
    if (typeof val !== "object") {
      const n = namePlaceholder(key, attrNames);
      const v = valuePlaceholder(val, attrValues);
      return `${n} = ${v}`;
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return "1 = 0";
      const n = namePlaceholder(key, attrNames);
      const placeholders = val.map((v) => valuePlaceholder(v, attrValues));
      return `${n} IN (${placeholders.join(", ")})`;
    }
    const filter = val as Filter;
    return buildOperator(key, filter.op, filter.val, attrNames, attrValues);
  });
  return {
    expr: clauses.join(" AND "),
    attrNames,
    attrValues,
  };
};

const isSinglePrimaryKeyLookup = (
  params: Params
): { hit: boolean; key?: string | number } => {
  const keys = Object.keys(params);
  if (keys.length !== 1 || keys[0] !== PK) return { hit: false };
  const v = params[PK];
  if (v === null) return { hit: false };
  if (typeof v === "object") return { hit: false };
  return { hit: true, key: v as string | number };
};

const extractPrimaryKeyList = (
  params: Params
): { hit: boolean; keys?: (string | number)[] } => {
  const keys = Object.keys(params);
  if (keys.length !== 1 || keys[0] !== PK) return { hit: false };
  const v = params[PK];
  if (Array.isArray(v)) {
    return { hit: true, keys: v as (string | number)[] };
  }
  if (v && typeof v === "object" && (v as Filter).op === "in") {
    return {
      hit: true,
      keys: (v as { op: "in"; val: (string | number)[] }).val,
    };
  }
  return { hit: false };
};

class Query extends GenericQuery {
  _client: DynamoDBDocumentClient;
  _table: string;
  _config: DynamoConfig;
  _log: LogFunc;
  _state: QueryState;

  constructor(
    client: DynamoDBDocumentClient,
    table: string,
    dbs: { config: DynamoConfig; log: LogFunc }
  ) {
    super();
    this._client = client;
    this._table = table;
    this._config = dbs.config;
    this._log = (...ps) => dbs.log(...ps);
    this._state = { params: {} };
  }

  find(params: Params, limit?: number, offset?: number, order?: Order): this {
    if (order && order.length > 0) {
      throw new NotSupportedByDBEngine(
        "Query.find: ordering on Scan results is not supported by DynamoDB."
      );
    }
    if (offset && offset > 0) {
      throw new NotSupportedByDBEngine(
        "Query.find: numeric offset is not supported by DynamoDB; use paginated ExclusiveStartKey instead."
      );
    }
    this._state = { params, limit, offset, order };
    return this;
  }

  findById(id: Params, limit?: number, offset?: number, order?: Order): this {
    return this.find(id, limit, offset, order);
  }

  findByIds(ids: Params, limit?: number, offset?: number, order?: Order): this {
    const params: Params = {};
    for (const key of Object.keys(ids)) {
      const v = ids[key];
      if (Array.isArray(v)) {
        params[key] = { op: "in", val: v } as Filter;
      } else {
        params[key] = v;
      }
    }
    return this.find(params, limit, offset, order);
  }

  async toArray<T>(): Promise<T[]> {
    const { params, limit } = this._state;

    const single = isSinglePrimaryKeyLookup(params);
    if (single.hit) {
      try {
        const res = await this._client.send(
          new GetCommand({
            TableName: this._table,
            Key: { [PK]: single.key },
          })
        );
        return (res.Item ? [res.Item as T] : []) as T[];
      } catch (e) {
        this._log("Error in toArray:", "GetItem", { params }, e);
        throw e;
      }
    }

    const batch = extractPrimaryKeyList(params);
    if (batch.hit && batch.keys) {
      if (batch.keys.length === 0) return [];
      try {
        const res = await this._client.send(
          new BatchGetCommand({
            RequestItems: {
              [this._table]: {
                Keys: batch.keys.map((k) => ({ [PK]: k })),
              },
            },
          })
        );
        const rows = (res.Responses?.[this._table] ?? []) as T[];
        return limit ? rows.slice(0, limit) : rows;
      } catch (e) {
        this._log("Error in toArray:", "BatchGetItem", { params }, e);
        throw e;
      }
    }

    const input = this._buildScanInput(params, limit);
    try {
      const res = await this._client.send(new ScanCommand(input));
      return (res.Items ?? []) as T[];
    } catch (e) {
      this._log("Error in toArray:", "Scan", { params }, e);
      throw e;
    }
  }

  async count(): Promise<number> {
    const { params, limit } = this._state;
    const input = this._buildScanInput(params, limit);
    input.Select = "COUNT";
    try {
      const res = await this._client.send(new ScanCommand(input));
      return res.Count ?? 0;
    } catch (e) {
      this._log("Error in count:", "Scan (COUNT)", { params }, e);
      throw e;
    }
  }

  _buildScanInput(params: Params, limit?: number): ScanCommandInput {
    const { expr, attrNames, attrValues } = buildFilterExpression(params);
    const input: ScanCommandInput = { TableName: this._table };
    if (expr) {
      input.FilterExpression = expr;
      input.ExpressionAttributeNames = attrNames;
      input.ExpressionAttributeValues = attrValues;
    }
    if (limit) {
      input.Limit = limit;
    }
    return input;
  }

  async insert(
    content: Record<string, unknown>[],
    returning: string[] = [PK]
  ): Promise<Record<string, Id>[]> {
    if (content.length === 0) return [];

    const missingKey = content.findIndex(
      (item) => item[PK] === undefined || item[PK] === null
    );
    if (missingKey !== -1) {
      throw new NotSupportedByDBEngine(
        `Query.insert: DynamoDB does not auto-generate primary keys; item at index ${missingKey} is missing "${PK}".`
      );
    }

    try {
      if (content.length === 1) {
        await this._client.send(
          new PutCommand({
            TableName: this._table,
            Item: content[0],
          })
        );
      } else {
        const chunks: Record<string, unknown>[][] = [];
        for (let i = 0; i < content.length; i += 25) {
          chunks.push(content.slice(i, i + 25));
        }
        for (const chunk of chunks) {
          await this._client.send(
            new BatchWriteCommand({
              RequestItems: {
                [this._table]: chunk.map((Item) => ({
                  PutRequest: { Item },
                })),
              },
            })
          );
        }
      }
    } catch (e) {
      this._log("Error in insert:", "PutItem/BatchWriteItem", { content }, e);
      throw e;
    }

    return content.map((item) => {
      const r: Record<string, Id> = {};
      for (const key of returning) {
        r[key] = item[key] as Id;
      }
      return r;
    });
  }

  async updateOne<T>(
    filter: Params,
    c: { [p: string]: unknown }
  ): Promise<Result<T>> {
    return this.update<T>(filter, c);
  }

  async update<T>(
    filter: Params,
    c: { [p: string]: unknown }
  ): Promise<Result<T>> {
    const single = isSinglePrimaryKeyLookup(filter);
    if (!single.hit) {
      throw new NotSupportedByDBEngine(
        `Query.update: DynamoDB UpdateItem requires a single primary key lookup on "${PK}"; got ${JSON.stringify(
          filter
        )}.`
      );
    }

    const setKeys = Object.keys(c);
    if (setKeys.length === 0) {
      return { rows: [] as T[], rowCount: 0 };
    }

    const attrNames: Record<string, string> = {};
    const attrValues: Record<string, unknown> = {};
    const assignments = setKeys.map((k) => {
      const n = namePlaceholder(k, attrNames);
      const v = valuePlaceholder(c[k], attrValues);
      return `${n} = ${v}`;
    });

    try {
      await this._client.send(
        new UpdateCommand({
          TableName: this._table,
          Key: { [PK]: single.key },
          UpdateExpression: "SET " + assignments.join(", "),
          ExpressionAttributeNames: attrNames,
          ExpressionAttributeValues: attrValues,
        })
      );
      return { rows: [] as T[], rowCount: 1 };
    } catch (e) {
      this._log("Error in update:", "UpdateItem", { filter, c }, e);
      throw e;
    }
  }

  async remove<T>(params: Params): Promise<Result<T>> {
    const single = isSinglePrimaryKeyLookup(params);
    if (single.hit) {
      try {
        await this._client.send(
          new DeleteCommand({
            TableName: this._table,
            Key: { [PK]: single.key },
          })
        );
        return { rows: [] as T[], rowCount: 1 };
      } catch (e) {
        this._log("Error in remove:", "DeleteItem", { params }, e);
        throw e;
      }
    }

    const batch = extractPrimaryKeyList(params);
    if (batch.hit && batch.keys) {
      if (batch.keys.length === 0) return { rows: [] as T[], rowCount: 0 };
      try {
        const chunks: (string | number)[][] = [];
        for (let i = 0; i < batch.keys.length; i += 25) {
          chunks.push(batch.keys.slice(i, i + 25));
        }
        for (const chunk of chunks) {
          await this._client.send(
            new BatchWriteCommand({
              RequestItems: {
                [this._table]: chunk.map((k) => ({
                  DeleteRequest: { Key: { [PK]: k } },
                })),
              },
            })
          );
        }
        return { rows: [] as T[], rowCount: batch.keys.length };
      } catch (e) {
        this._log("Error in remove:", "BatchWriteItem", { params }, e);
        throw e;
      }
    }

    throw new NotSupportedByDBEngine(
      `Query.remove: DynamoDB DeleteItem requires a primary key (single or array) on "${PK}"; got ${JSON.stringify(
        params
      )}.`
    );
  }

  async drop(): Promise<void> {
    throw new NotSupportedByDBEngine(
      "Query.drop: DynamoDB tables cannot be dropped through the query builder; use the DynamoDB control-plane API directly."
    );
  }
}

export default Query;
