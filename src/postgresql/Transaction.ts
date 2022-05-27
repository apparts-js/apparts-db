import Query from "./Query";
import { PoolClient } from "pg";
import { PGConfig } from "../Config";
import { LogFunc } from "./types";
import { Result, GenericTransaction, GenericQuery } from "../generic";

class Transaction extends GenericTransaction {
  _dbs: PoolClient;
  _config: PGConfig;
  _log: LogFunc;

  constructor(poolClient: PoolClient, dbs: { config: PGConfig; log: LogFunc }) {
    super();
    this._dbs = poolClient;
    this._log = (...ps) => dbs.log(...ps);
    this._config = dbs.config;
    this._dbs.query("BEGIN;");
  }

  async raw<T>(query: string, params: any[] = []): Promise<Result<T>> {
    try {
      return await this._dbs.query<T>(query, params);
    } catch (e) {
      this._log("Error in dbs.raw", query, params, e);
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
    this._dbs.query("COMMIT");
  }

  async rollback() {
    this._dbs.query("ROLLBACK");
  }

  async end() {
    this._dbs.release();
  }
}

export default Transaction;
