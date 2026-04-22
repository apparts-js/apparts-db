import { TransactWriteCommandInput } from "@aws-sdk/lib-dynamodb";

import { Id, NotSupportedByDBEngine, Params, Result } from "../generic";
import Query from "./Query";

export type TransactItem = NonNullable<
  TransactWriteCommandInput["TransactItems"]
>[number];

const PK = "id";

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

class TransactionQuery extends Query {
  _writes: TransactItem[];

  constructor(
    client: ConstructorParameters<typeof Query>[0],
    table: string,
    dbs: ConstructorParameters<typeof Query>[2],
    writes: TransactItem[]
  ) {
    super(client, table, dbs);
    this._writes = writes;
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
    for (const Item of content) {
      this._writes.push({
        Put: {
          TableName: this._table,
          Item,
          ConditionExpression: "attribute_not_exists(#pk)",
          ExpressionAttributeNames: { "#pk": PK },
        },
      });
    }
    return content.map((item) => {
      const r: Record<string, Id> = {};
      for (const key of returning) {
        r[key] = item[key] as Id;
      }
      return r;
    });
  }

  async update<T>(
    filter: Params,
    c: { [p: string]: unknown }
  ): Promise<Result<T>> {
    const single = isSinglePrimaryKeyLookup(filter);
    if (!single.hit) {
      throw new NotSupportedByDBEngine(
        `Transaction update: DynamoDB UpdateItem requires a single primary key lookup on "${PK}".`
      );
    }
    const setKeys = Object.keys(c);
    if (setKeys.length === 0) {
      return { rows: [] as T[], rowCount: 0 };
    }
    const attrNames: Record<string, string> = { "#pk": PK };
    const attrValues: Record<string, unknown> = {};
    const assignments = setKeys.map((k) => {
      const n = namePlaceholder(k, attrNames);
      const v = valuePlaceholder(c[k], attrValues);
      return `${n} = ${v}`;
    });
    this._writes.push({
      Update: {
        TableName: this._table,
        Key: { [PK]: single.key },
        UpdateExpression: "SET " + assignments.join(", "),
        ConditionExpression: "attribute_exists(#pk)",
        ExpressionAttributeNames: attrNames,
        ExpressionAttributeValues: attrValues,
      },
    });
    return { rows: [] as T[], rowCount: 1 };
  }

  async updateOne<T>(
    filter: Params,
    c: { [p: string]: unknown }
  ): Promise<Result<T>> {
    return this.update<T>(filter, c);
  }

  async remove<T>(params: Params): Promise<Result<T>> {
    const single = isSinglePrimaryKeyLookup(params);
    if (!single.hit) {
      throw new NotSupportedByDBEngine(
        `Transaction remove: DynamoDB DeleteItem inside a transaction requires a single primary key on "${PK}".`
      );
    }
    this._writes.push({
      Delete: {
        TableName: this._table,
        Key: { [PK]: single.key },
      },
    });
    return { rows: [] as T[], rowCount: 1 };
  }
}

export default TransactionQuery;
