import Database from "better-sqlite3";

import { GenericQuery, GenericTransaction, Result } from "../generic";
import { SqliteConfig } from "./Config";
import { Queriable } from "./Queriable";

class Transaction extends Queriable implements GenericTransaction {
  _db: Database.Database;

  constructor(db: Database.Database, dbs: { config: SqliteConfig }) {
    super();
    this._db = db;
    this._config = dbs.config;
  }

  async transaction<T>(): Promise<T> {
    throw new Error("Can not start new transaction in transaction");
  }

  async raw<T>(_query: string, _params: unknown[] = []): Promise<Result<T>> {
    throw new Error("SqliteTransaction.raw not implemented");
  }

  collection(_col: string): GenericQuery {
    throw new Error("SqliteTransaction.collection not implemented");
  }

  async commit(): Promise<void> {
    throw new Error("SqliteTransaction.commit not implemented");
  }

  async rollback(): Promise<void> {
    throw new Error("SqliteTransaction.rollback not implemented");
  }

  async end(): Promise<void> {
    throw new Error("SqliteTransaction.end not implemented");
  }
}

export default Transaction;
