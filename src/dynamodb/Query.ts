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
import {
  buildUpdateInput,
  isSinglePrimaryKeyLookup,
  namePlaceholder,
  valuePlaceholder,
} from "./filterHelpers";
import { LogFunc } from "./types";

export const isConditionalCheckFailed = (e: unknown): boolean =>
  typeof e === "object" &&
  e !== null &&
  "name" in e &&
  (e as { name: unknown }).name === "ConditionalCheckFailedException";

type QueryState = {
  params: Params;
  limit?: number;
  offset?: number;
  order?: Order;
};

export type FilterExprResult =
  | { kind: "empty" }
  | { kind: "always_false" }
  | {
      kind: "expr";
      expr: string;
      attrNames: Record<string, string>;
      attrValues: Record<string, unknown>;
    };

type OperatorResult =
  | { kind: "expr"; expr: string }
  | { kind: "always_false" }
  | { kind: "always_true" };

const PK = "id";

const buildOperator = (
  attr: string,
  op: string,
  val: unknown,
  attrNames: Record<string, string>,
  attrValues: Record<string, unknown>,
): OperatorResult => {
  switch (op) {
    case "exists": {
      const n = namePlaceholder(attr, attrNames);
      return {
        kind: "expr",
        expr: `${
          val === true ? "attribute_exists" : "attribute_not_exists"
        }(${n})`,
      };
    }
    case "in": {
      const vals = val as (string | number | boolean | null)[];
      if (vals.length === 0) {
        return { kind: "always_false" };
      }
      const n = namePlaceholder(attr, attrNames);
      const placeholders = vals.map((v) => valuePlaceholder(v, attrValues));
      return { kind: "expr", expr: `${n} IN (${placeholders.join(", ")})` };
    }
    case "notin": {
      const vals = val as (string | number | boolean | null)[];
      if (vals.length === 0) {
        return { kind: "always_true" };
      }
      const n = namePlaceholder(attr, attrNames);
      const placeholders = vals.map((v) => valuePlaceholder(v, attrValues));
      return {
        kind: "expr",
        expr: `NOT (${n} IN (${placeholders.join(", ")}))`,
      };
    }
    case "lte": {
      const n = namePlaceholder(attr, attrNames);
      return {
        kind: "expr",
        expr: `${n} <= ${valuePlaceholder(val, attrValues)}`,
      };
    }
    case "lt": {
      const n = namePlaceholder(attr, attrNames);
      return {
        kind: "expr",
        expr: `${n} < ${valuePlaceholder(val, attrValues)}`,
      };
    }
    case "gte": {
      const n = namePlaceholder(attr, attrNames);
      return {
        kind: "expr",
        expr: `${n} >= ${valuePlaceholder(val, attrValues)}`,
      };
    }
    case "gt": {
      const n = namePlaceholder(attr, attrNames);
      return {
        kind: "expr",
        expr: `${n} > ${valuePlaceholder(val, attrValues)}`,
      };
    }
    case "and": {
      const sub = (val as { op: string; val: unknown }[]).map((v) =>
        buildOperator(attr, v.op, v.val, attrNames, attrValues),
      );
      if (sub.some((r) => r.kind === "always_false")) {
        return { kind: "always_false" };
      }
      const exprs = sub
        .filter((r): r is { kind: "expr"; expr: string } => r.kind === "expr")
        .map((r) => r.expr);
      if (exprs.length === 0) {
        return { kind: "always_true" };
      }
      return { kind: "expr", expr: `(${exprs.join(" AND ")})` };
    }
    case "like":
    case "ilike":
      throw new NotSupportedByDBEngine(
        `Query filter operator "${op}" is not supported by DynamoDB.`,
      );
    case "of":
      throw new NotSupportedByDBEngine(
        `Query filter operator "of" (nested JSON path) is not supported by DynamoDB.`,
      );
    case "oftype":
      throw new NotSupportedByDBEngine(
        `Query filter operator "oftype" is not supported by DynamoDB.`,
      );
    default:
      throw new NotSupportedByDBEngine(
        `Query filter operator "${op}" is not supported by DynamoDB.`,
      );
  }
};

export const buildFilterExpression = (params: Params): FilterExprResult => {
  const attrNames: Record<string, string> = {};
  const attrValues: Record<string, unknown> = {};
  const keys = Object.keys(params);
  if (keys.length === 0) {
    return { kind: "empty" };
  }
  const clauses: string[] = [];
  for (const key of keys) {
    const val = params[key];
    if (val === null) {
      const n = namePlaceholder(key, attrNames);
      // Match both "attribute absent" and "attribute stored as DynamoDB NULL".
      const v = valuePlaceholder(null, attrValues);
      clauses.push(`(attribute_not_exists(${n}) OR ${n} = ${v})`);
      continue;
    }
    if (typeof val !== "object") {
      const n = namePlaceholder(key, attrNames);
      const v = valuePlaceholder(val, attrValues);
      clauses.push(`${n} = ${v}`);
      continue;
    }
    if (Array.isArray(val)) {
      if (val.length === 0) {
        return { kind: "always_false" };
      }
      const n = namePlaceholder(key, attrNames);
      const placeholders = val.map((v) => valuePlaceholder(v, attrValues));
      clauses.push(`${n} IN (${placeholders.join(", ")})`);
      continue;
    }
    const filter = val as Filter;
    const r = buildOperator(key, filter.op, filter.val, attrNames, attrValues);
    if (r.kind === "always_false") {
      return { kind: "always_false" };
    }
    if (r.kind === "always_true") {
      continue;
    }
    clauses.push(r.expr);
  }
  if (clauses.length === 0) {
    // All clauses were always_true (or there were no clauses) — collapse
    // to "empty" so the caller emits no FilterExpression. A Scan with no
    // FilterExpression matches every row, which is what always_true means.
    return { kind: "empty" };
  }
  return {
    kind: "expr",
    expr: clauses.join(" AND "),
    attrNames,
    attrValues,
  };
};

const extractPrimaryKeyList = (
  params: Params,
): { hit: boolean; keys?: (string | number)[] } => {
  const keys = Object.keys(params);
  if (keys.length !== 1 || keys[0] !== PK) {
    return { hit: false };
  }
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
    dbs: { config: DynamoConfig; log: LogFunc },
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
        "Query.find: ordering on Scan results is not supported by DynamoDB.",
      );
    }
    if (offset && offset > 0) {
      throw new NotSupportedByDBEngine(
        "Query.find: numeric offset is not supported by DynamoDB. " +
          "DynamoDB Scan/Query has no SKIP semantics — paginate with " +
          "limit-only and either (a) re-run the query with a tighter " +
          "filter on the next page's first key, or (b) call findByIds " +
          "with a known id list, or (c) fetch with limit and slice " +
          "client-side for small result sets.",
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
          }),
        );
        return (res.Item ? [res.Item as T] : []) as T[];
      } catch (e) {
        this._log("Error in toArray:", "GetItem", { params }, e);
        throw e;
      }
    }

    const batch = extractPrimaryKeyList(params);
    if (batch.hit && batch.keys) {
      if (batch.keys.length === 0) {
        return [];
      }
      try {
        const rows: T[] = [];
        let pending: Record<string, unknown>[] = batch.keys.map((k) => ({
          [PK]: k,
        }));
        while (pending.length > 0) {
          const res = await this._client.send(
            new BatchGetCommand({
              RequestItems: { [this._table]: { Keys: pending } },
            }),
          );
          rows.push(...((res.Responses?.[this._table] ?? []) as T[]));
          const next = res.UnprocessedKeys?.[this._table]?.Keys;
          pending = Array.isArray(next)
            ? (next as Record<string, unknown>[])
            : [];
        }
        return limit ? rows.slice(0, limit) : rows;
      } catch (e) {
        this._log("Error in toArray:", "BatchGetItem", { params }, e);
        throw e;
      }
    }

    const scanInput = this._buildScanInput(params, limit);
    if (scanInput.kind === "always_false") {
      return [];
    }
    try {
      const rows: T[] = [];
      let startKey: Record<string, unknown> | undefined;
      do {
        if (startKey) {
          scanInput.input.ExclusiveStartKey = startKey;
        }
        const res = await this._client.send(new ScanCommand(scanInput.input));
        rows.push(...((res.Items ?? []) as T[]));
        if (limit && rows.length >= limit) {
          return rows.slice(0, limit);
        }
        startKey = res.LastEvaluatedKey;
      } while (startKey);
      return rows;
    } catch (e) {
      this._log("Error in toArray:", "Scan", { params }, e);
      throw e;
    }
  }

  async count(): Promise<number> {
    const { params, limit } = this._state;
    const scanInput = this._buildScanInput(params, limit);
    if (scanInput.kind === "always_false") {
      return 0;
    }
    scanInput.input.Select = "COUNT";
    try {
      let total = 0;
      let startKey: Record<string, unknown> | undefined;
      do {
        if (startKey) {
          scanInput.input.ExclusiveStartKey = startKey;
        }
        const res = await this._client.send(new ScanCommand(scanInput.input));
        total += res.Count ?? 0;
        if (limit && total >= limit) {
          return limit;
        }
        startKey = res.LastEvaluatedKey;
      } while (startKey);
      return total;
    } catch (e) {
      this._log("Error in count:", "Scan (COUNT)", { params }, e);
      throw e;
    }
  }

  _buildScanInput(
    params: Params,
    limit?: number,
  ): { kind: "always_false" } | { kind: "input"; input: ScanCommandInput } {
    const filter = buildFilterExpression(params);
    if (filter.kind === "always_false") {
      return { kind: "always_false" };
    }
    const input: ScanCommandInput = { TableName: this._table };
    if (filter.kind === "expr") {
      input.FilterExpression = filter.expr;
      if (Object.keys(filter.attrNames).length > 0) {
        input.ExpressionAttributeNames = filter.attrNames;
      }
      // DynamoDB rejects ExpressionAttributeValues = {}; only include it
      // when the expression actually uses a value placeholder - exists /
      // null (attribute_not_exists) filters don't.
      if (Object.keys(filter.attrValues).length > 0) {
        input.ExpressionAttributeValues = filter.attrValues;
      }
    }
    if (limit) {
      input.Limit = limit;
    }
    return { kind: "input", input };
  }

  async insert(
    content: Record<string, unknown>[],
    returning: string[] = [PK],
  ): Promise<Record<string, Id>[]> {
    // Validate before any early returns so failure conditions are prominent.
    // DynamoDB has no atomic multi-row PutItem, and individual Puts can
    // partially fail in unpredictable ways. Rather than expose the user
    // to that, only allow single-row insert here — multi-row callers must
    // either loop themselves, use insertOrUpdate (which has no uniqueness
    // contract to violate), or stage writes inside a Transaction.
    if (content.length > 1) {
      throw new NotSupportedByDBEngine(
        "Query.insert: multi-row insert is not supported by DynamoDB " +
          "(no atomic multi-row Put). Insert one row at a time, use " +
          "insertOrUpdate for upsert semantics, or use insert in " +
          "a transaction for atomicity.",
      );
    }

    if (content.length === 0) {
      return [];
    }

    const item = content[0];
    if (item[PK] === undefined || item[PK] === null) {
      throw new NotSupportedByDBEngine(
        `Query.insert: DynamoDB does not auto-generate primary keys; item is missing "${PK}".`,
      );
    }

    // PutCommand with attribute_not_exists so a duplicate primary key
    // surfaces as `{_code: 1}`, matching the Postgres driver's 23505
    // translation.
    try {
      await this._client.send(
        new PutCommand({
          TableName: this._table,
          Item: item,
          ConditionExpression: "attribute_not_exists(#pk)",
          ExpressionAttributeNames: { "#pk": PK },
        }),
      );
    } catch (e) {
      if (isConditionalCheckFailed(e)) {
        return Promise.reject({
          msg: "ERROR, tried to insert, not unique",
          _code: 1,
        });
      }
      this._log("Error in insert:", "PutItem", { content }, e);
      throw e;
    }

    const r: Record<string, Id> = {};
    for (const key of returning) {
      r[key] = item[key] as Id;
    }
    return [r];
  }

  async insertOrUpdate(
    content: Record<string, unknown>[],
    returning: string[] = [PK],
  ): Promise<Record<string, Id>[]> {
    if (content.length === 0) {
      return [];
    }

    const missingKey = content.findIndex(
      (item) => item[PK] === undefined || item[PK] === null,
    );
    if (missingKey !== -1) {
      throw new NotSupportedByDBEngine(
        `Query.insertOrUpdate: DynamoDB does not auto-generate primary keys; item at index ${missingKey} is missing "${PK}".`,
      );
    }

    // Plain PutCommand with no ConditionExpression — overwrites on
    // duplicate primary key. Multi-row callers get parallel Puts; the
    // overall operation is non-atomic, but each individual upsert is.
    try {
      await Promise.all(
        content.map((Item) =>
          this._client.send(
            new PutCommand({
              TableName: this._table,
              Item,
            }),
          ),
        ),
      );
    } catch (e) {
      this._log("Error in insertOrUpdate:", "PutItem", { content }, e);
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
    c: { [p: string]: unknown },
  ): Promise<Result<T>> {
    return this.update<T>(filter, c);
  }

  async update<T>(
    filter: Params,
    c: { [p: string]: unknown },
  ): Promise<Result<T>> {
    const single = isSinglePrimaryKeyLookup(filter);
    if (!single.hit) {
      throw new NotSupportedByDBEngine(
        `Query.update: DynamoDB UpdateItem requires a single primary key lookup on "${PK}"; got ${JSON.stringify(
          filter,
        )}.`,
      );
    }

    const input = buildUpdateInput(this._table, single.key!, c);
    if (input === null) {
      return { rows: [] as T[], rowCount: 0 };
    }

    try {
      await this._client.send(new UpdateCommand(input));
      return { rows: [] as T[], rowCount: 1 };
    } catch (e) {
      if (isConditionalCheckFailed(e)) {
        return { rows: [] as T[], rowCount: 0 };
      }
      this._log("Error in update:", "UpdateItem", { filter, c }, e);
      throw e;
    }
  }

  async remove<T>(params: Params): Promise<Result<T>> {
    const single = isSinglePrimaryKeyLookup(params);
    const batch = extractPrimaryKeyList(params);

    if (!single.hit && !batch.hit) {
      throw new NotSupportedByDBEngine(
        `Query.remove: DynamoDB DeleteItem requires a primary key (single or array) on "${PK}"; got ${JSON.stringify(
          params,
        )}.`,
      );
    }

    if (single.hit) {
      try {
        await this._client.send(
          new DeleteCommand({
            TableName: this._table,
            Key: { [PK]: single.key },
          }),
        );
        return { rows: [] as T[], rowCount: 1 };
      } catch (e) {
        this._log("Error in remove:", "DeleteItem", { params }, e);
        throw e;
      }
    }

    // batch.hit must be true here
    if (!batch.keys || batch.keys.length === 0) {
      return { rows: [] as T[], rowCount: 0 };
    }

    try {
      const chunks: (string | number)[][] = [];
      for (let i = 0; i < batch.keys.length; i += 25) {
        chunks.push(batch.keys.slice(i, i + 25));
      }
      for (const chunk of chunks) {
        let pending = chunk.map((k) => ({
          DeleteRequest: { Key: { [PK]: k } },
        }));
        while (pending.length > 0) {
          const res = await this._client.send(
            new BatchWriteCommand({
              RequestItems: { [this._table]: pending },
            }),
          );
          const next = res.UnprocessedItems?.[this._table];
          pending = Array.isArray(next) ? (next as typeof pending) : [];
        }
      }
      return { rows: [] as T[], rowCount: batch.keys.length };
    } catch (e) {
      this._log("Error in remove:", "BatchWriteItem", { params }, e);
      throw e;
    }
  }

  async drop(): Promise<void> {
    throw new NotSupportedByDBEngine(
      "Query.drop: DynamoDB tables cannot be dropped through the query builder; use the DynamoDB control-plane API directly.",
    );
  }
}

export default Query;
