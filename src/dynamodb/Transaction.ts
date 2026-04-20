import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  GenericQuery,
  GenericTransaction,
  NotSupportedByDBEngine,
  Result,
} from "../generic";
import { DynamoConfig } from "./Config";
import { Queriable } from "./Queriable";
import TransactionQuery, { TransactItem } from "./TransactionQuery";

class Transaction extends Queriable implements GenericTransaction {
  _client: DynamoDBDocumentClient;
  _writes: TransactItem[];
  _finished: boolean;

  constructor(client: DynamoDBDocumentClient, dbs: { config: DynamoConfig }) {
    super();
    this._client = client;
    this._config = dbs.config;
    this._writes = [];
    this._finished = false;
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
    return new TransactionQuery(
      this._client,
      table,
      {
        config: this._config,
        log: (...ps) => this._log(...ps),
      },
      this._writes
    );
  }

  async commit(): Promise<void> {
    if (this._finished) return;
    this._finished = true;
    if (this._writes.length === 0) return;
    if (this._writes.length > 100) {
      throw new NotSupportedByDBEngine(
        `Transaction.commit: DynamoDB TransactWriteItems is limited to 100 operations; got ${this._writes.length}.`
      );
    }
    try {
      await this._client.send(
        new TransactWriteCommand({ TransactItems: this._writes })
      );
    } catch (e) {
      this._log("Error in commit:", "TransactWriteItems", {}, e);
      throw e;
    }
  }

  async rollback(): Promise<void> {
    this._finished = true;
    this._writes.length = 0;
  }

  async end(): Promise<void> {
    this._writes.length = 0;
  }
}

export default Transaction;
