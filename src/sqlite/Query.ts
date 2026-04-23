import Database from "better-sqlite3";

import {
  GenericQuery,
  Id,
  NotSupportedByDBEngine,
  Order,
  Params,
  Result,
} from "../generic";
import { SqliteConfig } from "./Config";
import { LogFunc } from "./types";

class Query extends GenericQuery {
  _db: Database.Database;
  _table: string;
  _config: SqliteConfig;
  _log: LogFunc;
  _fromQuery?: string;
  _params?: unknown[];

  constructor(
    db: Database.Database,
    table: string,
    dbs: { config: SqliteConfig; log: LogFunc }
  ) {
    super();
    this._db = db;
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
    throw new Error("SqliteQuery.find not implemented");
  }

  findById(
    _id: Params,
    _limit?: number,
    _offset?: number,
    _order?: Order
  ): this {
    throw new Error("SqliteQuery.findById not implemented");
  }

  findByIds(
    _ids: Params,
    _limit?: number,
    _offset?: number,
    _order?: Order
  ): this {
    throw new Error("SqliteQuery.findByIds not implemented");
  }

  async toArray<T>(): Promise<T[]> {
    throw new Error("SqliteQuery.toArray not implemented");
  }

  async count(): Promise<number> {
    throw new Error("SqliteQuery.count not implemented");
  }

  async insert<Rs extends string[]>(
    _content: Record<string, unknown>[],
    _returning?: Rs
  ): Promise<Record<string, Id>[]> {
    throw new Error("SqliteQuery.insert not implemented");
  }

  async updateOne<T>(
    _filter: Params,
    _c: { [p: string]: unknown }
  ): Promise<Result<T>> {
    throw new Error("SqliteQuery.updateOne not implemented");
  }

  async update<T>(
    _filter: Params,
    _c: { [p: string]: unknown }
  ): Promise<Result<T>> {
    throw new Error("SqliteQuery.update not implemented");
  }

  async remove<T>(_params: Params): Promise<Result<T>> {
    throw new Error("SqliteQuery.remove not implemented");
  }

  async drop(): Promise<void> {
    throw new Error("SqliteQuery.drop not implemented");
  }

  _notSupported(op: string): never {
    throw new NotSupportedByDBEngine(
      `Query filter operator "${op}" is not supported by SQLite.`
    );
  }
}

export default Query;
