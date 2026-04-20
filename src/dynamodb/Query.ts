import {
  GenericQuery,
  Id,
  NotSupportedByDBEngine,
  Order,
  Params,
  Result,
} from "../generic";
import { DynamoConfig } from "./Config";
import { LogFunc } from "./types";

class Query extends GenericQuery {
  _client: unknown;
  _table: string;
  _config: DynamoConfig;
  _log: LogFunc;

  constructor(
    client: unknown,
    table: string,
    dbs: { config: DynamoConfig; log: LogFunc }
  ) {
    super();
    this._client = client;
    this._table = table;
    this._config = dbs.config;
    this._log = (...ps) => dbs.log(...ps);
  }

  find(
    _params: Params,
    _limit?: number,
    _offset?: number,
    _order?: Order
  ): this {
    throw new Error("Not yet implemented: Query.find");
  }

  findById(id: Params, limit?: number, offset?: number, order?: Order): this {
    return this.find(id, limit, offset, order);
  }

  findByIds(
    _ids: Params,
    _limit?: number,
    _offset?: number,
    _order?: Order
  ): this {
    throw new Error("Not yet implemented: Query.findByIds");
  }

  async toArray<T>(): Promise<T[]> {
    throw new Error("Not yet implemented: Query.toArray");
  }

  async count(): Promise<number> {
    throw new Error("Not yet implemented: Query.count");
  }

  async insert(
    _content: unknown[],
    _returning?: string[]
  ): Promise<Record<string, Id>[]> {
    throw new Error("Not yet implemented: Query.insert");
  }

  async updateOne<T>(
    filter: Params,
    c: { [p: string]: unknown }
  ): Promise<Result<T>> {
    return this.update<T>(filter, c);
  }

  async update<T>(
    _filter: Params,
    _c: { [p: string]: unknown }
  ): Promise<Result<T>> {
    throw new Error("Not yet implemented: Query.update");
  }

  async remove<T>(_params: Params): Promise<Result<T>> {
    throw new Error("Not yet implemented: Query.remove");
  }

  async drop(): Promise<void> {
    throw new NotSupportedByDBEngine(
      "Query.drop: DynamoDB tables cannot be dropped through the query builder; use the DynamoDB control-plane API directly."
    );
  }
}

export default Query;
