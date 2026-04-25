import Query from "./Query";
import { PoolClient, QueryResultRow } from "pg";
import { PGConfig } from "./Config";
import { Result, GenericTransaction, GenericQuery } from "../generic";

import { Queriable } from "./Queriable";

class Transaction extends Queriable implements GenericTransaction {
  _dbs: PoolClient;
  async transaction<T>(): Promise<T> {
    throw new Error("Can not start new transaction in transaction");
  }

  constructor(poolClient: PoolClient, dbs: { config: PGConfig }) {
    super();
    this._dbs = poolClient;
    this._config = dbs.config;
    this._dbs.query("BEGIN;");
  }

  async raw<T>(query: string, params: unknown[] = []): Promise<Result<T>> {
    try {
      const res = await this._dbs.query<QueryResultRow>(query, params);
      return { rows: res.rows as T[], rowCount: res.rowCount };
    } catch (e) {
      this._log("Error in dbs.raw", query, { params }, e);
      throw e;
    }
  }

  collection(col: string): GenericQuery {
    return new Query(this._dbs, col, {
      config: this._config,
      log: (...ps) => this._log(...ps),
    });
  }

  async commit() {
    await this._dbs.query("COMMIT");
  }

  async rollback() {
    await this._dbs.query("ROLLBACK");
  }

  async end() {
    this._dbs.release();
  }
}

export default Transaction;
