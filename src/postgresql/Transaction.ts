import Query from "./Query";
import { PoolClient } from "pg";
import { PGConfig } from "../Config";
import { LogFunc } from "./types";

class Transaction {
  _dbs: PoolClient;
  _config: PGConfig;
  _log: LogFunc;

  constructor(poolClient: PoolClient, dbs: { config: PGConfig; log: LogFunc }) {
    this._dbs = poolClient;
    this._log = (...ps) => dbs.log(...ps);
    this._config = dbs.config;
    this._dbs.query("BEGIN;");
  }

  async raw(query: string, params: any[]) {
    try {
      return await this._dbs.query(query, params);
    } catch (e) {
      this._log("Error in dbs.raw", query, params, e);
      throw e;
    }
  }

  collection(col: string) {
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
