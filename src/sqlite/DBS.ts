import Database from "better-sqlite3";

import { GenericDBS, Result } from "../generic";
import { SqliteConfig } from "./Config";
import { Queriable } from "./Queriable";
import Query from "./Query";
import Transaction from "./Transaction";

class DBS extends Queriable implements GenericDBS {
  _db: Database.Database;

  constructor(db: Database.Database, config: SqliteConfig) {
    super();
    this._db = db;
    this._config = config;
  }

  collection(col: string): Query {
    return new Query(this._db, col, {
      config: this._config,
      log: (...ps) => this._log(...ps),
    });
  }

  async transaction<T>(fn: (t: Transaction) => Promise<T>): Promise<T> {
    const tx = new Transaction(this._db, { config: this._config });
    try {
      const result = await fn(tx);
      await tx.commit();
      return result;
    } catch (e) {
      await tx.rollback();
      throw e;
    } finally {
      await tx.end();
    }
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

  async shutdown(): Promise<void> {
    this._db.close();
  }
}

export default DBS;
