import { TransactWriteCommandInput } from "@aws-sdk/lib-dynamodb";

import { Id, NotSupportedByDBEngine, Order, Params, Result } from "../generic";
import { buildUpdateInput, isSinglePrimaryKeyLookup } from "./filterHelpers";
import Query from "./Query";

export type TransactItem = NonNullable<
  TransactWriteCommandInput["TransactItems"]
>[number];

const PK = "id";

// TransactWriteItems buffers writes client-side until commit(), and DynamoDB
// has no way to observe the buffered writes on reads. Rather than silently
// returning stale data, reject every read path - the caller should stage
// writes, commit, and then read via the outer DBS. See audit finding H-TQ1.
const REJECT_READ = () =>
  new NotSupportedByDBEngine(
    "Reads inside a DynamoDB transaction are not supported - the buffered writes are not visible to Scan/Get until commit(). Commit the transaction and read via the outer DBS."
  );

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

  find(
    _params: Params,
    _limit?: number,
    _offset?: number,
    _order?: Order
  ): this {
    throw REJECT_READ();
  }

  findById(
    _id: Params,
    _limit?: number,
    _offset?: number,
    _order?: Order
  ): this {
    throw REJECT_READ();
  }

  findByIds(
    _ids: Params,
    _limit?: number,
    _offset?: number,
    _order?: Order
  ): this {
    throw REJECT_READ();
  }

  async toArray<T>(): Promise<T[]> {
    throw REJECT_READ();
  }

  async count(): Promise<number> {
    throw REJECT_READ();
  }

  async drop(): Promise<void> {
    throw new NotSupportedByDBEngine(
      "TransactionQuery.drop: DynamoDB tables cannot be dropped inside a transaction."
    );
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

  async insertOrUpdate(
    content: Record<string, unknown>[],
    returning: string[] = [PK]
  ): Promise<Record<string, Id>[]> {
    if (content.length === 0) return [];
    const missingKey = content.findIndex(
      (item) => item[PK] === undefined || item[PK] === null
    );
    if (missingKey !== -1) {
      throw new NotSupportedByDBEngine(
        `Query.insertOrUpdate: DynamoDB does not auto-generate primary keys; item at index ${missingKey} is missing "${PK}".`
      );
    }
    for (const Item of content) {
      this._writes.push({
        Put: {
          TableName: this._table,
          Item,
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
    const input = buildUpdateInput(this._table, single.key!, c);
    if (input === null) return { rows: [] as T[], rowCount: 0 };
    this._writes.push({ Update: input });
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
