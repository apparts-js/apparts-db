import {
  GenericQuery,
  GenericTransaction,
  NotSupportedByDBEngine,
  Result,
} from "../generic";
import { DynamoConfig } from "./Config";
import Query from "./Query";
import { Queriable } from "./Queriable";

class Transaction extends Queriable implements GenericTransaction {
  _client: unknown;
  _writes: unknown[];

  constructor(client: unknown, dbs: { config: DynamoConfig }) {
    super();
    this._client = client;
    this._config = dbs.config;
    this._writes = [];
  }

  async transaction<T>(): Promise<T> {
    throw new Error("Can not start new transaction in transaction");
  }

  async raw<T>(_query: string, _params?: unknown[]): Promise<Result<T>> {
    throw new NotSupportedByDBEngine(
      "Transaction.raw: DynamoDB does not expose raw SQL queries."
    );
  }

  collection(table: string): GenericQuery {
    return new Query(this._client, table, {
      config: this._config,
      log: (...ps) => this._log(...ps),
    });
  }

  async commit(): Promise<void> {
    throw new Error("Not yet implemented: Transaction.commit");
  }

  async rollback(): Promise<void> {
    throw new Error("Not yet implemented: Transaction.rollback");
  }

  async end(): Promise<void> {
    throw new Error("Not yet implemented: Transaction.end");
  }
}

export default Transaction;
