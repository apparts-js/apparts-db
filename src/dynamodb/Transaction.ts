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
import { RAW_COMMAND_FACTORIES, RAW_OPERATIONS } from "./rawCommands";

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

  async raw<T>(query: string, params?: unknown[]): Promise<Result<T>> {
    const factory = RAW_COMMAND_FACTORIES[query];
    if (!factory) {
      throw new NotSupportedByDBEngine(
        `Transaction.raw: unknown DynamoDB operation "${query}". Supported: ${RAW_OPERATIONS.join(
          ", "
        )}.`
      );
    }
    const input = params?.[0];
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new NotSupportedByDBEngine(
        `Transaction.raw: DynamoDB ${query} requires a single plain-object input as params[0].`
      );
    }
    const res = (await this._client.send(factory(input))) as Record<
      string,
      unknown
    >;
    const items =
      (res.Items as T[] | undefined) ?? (res.Item ? ([res.Item] as T[]) : []);
    const rowCount = (res.Count as number | undefined) ?? items.length;
    return { rows: items, rowCount };
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
    if (this._finished) {
      return;
    }
    if (this._writes.length === 0) {
      this._finished = true;
      return;
    }
    if (this._writes.length > 100) {
      // Validate BEFORE marking the transaction finished so a caller that
      // catches this error can split the work into smaller batches.
      throw new NotSupportedByDBEngine(
        `Transaction.commit: DynamoDB TransactWriteItems is limited to 100 operations; got ${this._writes.length}.`
      );
    }
    try {
      await this._client.send(
        new TransactWriteCommand({ TransactItems: this._writes })
      );
      this._finished = true;
    } catch (e) {
      // Do not set _finished here - the server rejected this attempt, so a
      // subsequent rollback() by the DBS.transaction wrapper needs to be
      // allowed to clear the queue.
      this._log("Error in commit:", "TransactWriteItems", {}, e);
      throw e;
    }
  }

  async rollback(): Promise<void> {
    if (this._finished) {
      // DynamoDB transactions commit atomically on the server; a post-commit
      // rollback cannot undo anything. Log so the caller does not silently
      // believe an already-committed transaction was rolled back, but do not
      // throw - the DBS.transaction wrapper calls rollback in its catch and
      // an error here would mask the original exception.
      this._log(
        "Warning in rollback:",
        "TransactWriteItems",
        {},
        new Error(
          "Transaction.rollback: called after the transaction was already committed or rolled back; the server-side state cannot be undone."
        )
      );
      return;
    }
    this._finished = true;
    this._writes.length = 0;
  }

  async end(): Promise<void> {
    this._writes.length = 0;
  }
}

export default Transaction;
