import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { GenericDBS, NotSupportedByDBEngine, Result } from "../generic";
import { DynamoConfig } from "./Config";
import Query from "./Query";
import Transaction from "./Transaction";
import { Queriable } from "./Queriable";

class DBS extends Queriable implements GenericDBS {
  _client: DynamoDBDocumentClient;
  _raw: DynamoDBClient;

  constructor(
    client: DynamoDBDocumentClient,
    rawClient: DynamoDBClient,
    config: DynamoConfig
  ) {
    super();
    this._client = client;
    this._raw = rawClient;
    this._config = config;
  }

  collection(table: string): Query {
    return new Query(this._client, table, {
      config: this._config,
      log: (...ps) => this._log(...ps),
    });
  }

  async transaction<T>(fn: (t: Transaction) => Promise<T>): Promise<T> {
    const tx = new Transaction(this._client, { config: this._config });
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

  async raw<T>(_query: string, _params?: unknown[]): Promise<Result<T>> {
    throw new NotSupportedByDBEngine(
      "DBS.raw: DynamoDB does not expose raw SQL queries."
    );
  }

  async shutdown(): Promise<void> {
    this._client.destroy();
    this._raw.destroy();
  }
}

export default DBS;
