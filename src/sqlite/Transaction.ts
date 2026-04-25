import Database from "better-sqlite3";

import { GenericQuery, GenericTransaction, Result } from "../generic";
import { SqliteConfig } from "./Config";
import { Queriable } from "./Queriable";
import Query from "./Query";

class Transaction extends Queriable implements GenericTransaction {
  _db: Database.Database;
  _finished: boolean;

  constructor(db: Database.Database, dbs: { config: SqliteConfig }) {
    super();
    this._db = db;
    this._config = dbs.config;
    this._finished = false;
    this._db.prepare("BEGIN").run();
  }

  async transaction<T>(): Promise<T> {
    throw new Error("Can not start new transaction in transaction");
  }

  async raw<T>(query: string, params: unknown[] = []): Promise<Result<T>> {
    try {
      const stmt = this._db.prepare(query);
      if (stmt.reader) {
        const rows = stmt.all(...(params as never[])) as T[];
        return { rows, rowCount: rows.length };
      }
      const info = stmt.run(...(params as never[]));
      return { rows: [], rowCount: info.changes };
    } catch (e) {
      this._log("Error in dbs.raw", query, { params }, e);
      throw e;
    }
  }

  collection(col: string): GenericQuery {
    return new Query(this._db, col, {
      config: this._config,
      log: (...ps) => this._log(...ps),
    });
  }

  async commit(): Promise<void> {
    if (this._finished) return;
    this._finished = true;
    this._db.prepare("COMMIT").run();
  }

  async rollback(): Promise<void> {
    if (this._finished) return;
    this._finished = true;
    this._db.prepare("ROLLBACK").run();
  }

  async end(): Promise<void> {
    // No connection to release - better-sqlite3 shares the Database handle
    // with the parent DBS, which owns its lifecycle via shutdown().
  }
}

export default Transaction;
