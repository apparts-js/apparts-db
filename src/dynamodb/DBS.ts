import { GenericDBS, NotSupportedByDBEngine, Result } from "../generic";
import { DynamoConfig } from "./Config";
import Query from "./Query";
import Transaction from "./Transaction";
import { Queriable } from "./Queriable";

class DBS extends Queriable implements GenericDBS {
  _client: unknown;

  constructor(client: unknown, config: DynamoConfig) {
    super();
    this._client = client;
    this._config = config;
  }

  collection(table: string): Query {
    return new Query(this._client, table, {
      config: this._config,
      log: (...ps) => this._log(...ps),
    });
  }

  async transaction<T>(_fn: (t: Transaction) => Promise<T>): Promise<T> {
    throw new Error("Not yet implemented: DBS.transaction");
  }

  async raw<T>(_query: string, _params?: unknown[]): Promise<Result<T>> {
    throw new NotSupportedByDBEngine(
      "DBS.raw: DynamoDB does not expose raw SQL queries."
    );
  }

  async shutdown(): Promise<void> {
    throw new Error("Not yet implemented: DBS.shutdown");
  }
}

export default DBS;
