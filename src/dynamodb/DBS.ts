import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import { GenericDBS, NotSupportedByDBEngine, Result } from "../generic";
import { DynamoConfig } from "./Config";
import Query from "./Query";
import Transaction from "./Transaction";
import { Queriable } from "./Queriable";

// Whitelist of DynamoDB DocumentClient operations that DBS.raw forwards.
// Anything else is rejected up front rather than papering over an
// unrecognized op string with a generic SDK error. Inputs are typed as
// the SDK's InputType-erased shape (any) since the caller is already
// reaching for the escape hatch — they are responsible for shaping the
// request correctly per the AWS SDK docs.
/* eslint-disable @typescript-eslint/no-explicit-any */
const RAW_COMMAND_FACTORIES: Record<string, (input: any) => any> = {
  Scan: (input) => new ScanCommand(input),
  Query: (input) => new QueryCommand(input),
  GetItem: (input) => new GetCommand(input),
  PutItem: (input) => new PutCommand(input),
  UpdateItem: (input) => new UpdateCommand(input),
  DeleteItem: (input) => new DeleteCommand(input),
  BatchGet: (input) => new BatchGetCommand(input),
  BatchWrite: (input) => new BatchWriteCommand(input),
};
/* eslint-enable @typescript-eslint/no-explicit-any */

class DBS extends Queriable implements GenericDBS {
  _client: DynamoDBDocumentClient;
  _raw: DynamoDBClient;

  constructor(
    client: DynamoDBDocumentClient,
    rawClient: DynamoDBClient,
    config: DynamoConfig,
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

  /**
   * DynamoDB has no SQL, but it does take typed JSON request objects per
   * operation. raw(operation, [input]) forwards to the matching SDK
   * Command after validating the operation is on the whitelist and the
   * input is a plain object. This is the escape hatch for callers that
   * need an op the high-level Query API doesn't expose (e.g. Query
   * against a GSI, ConsistentRead, ProjectionExpression).
   */
  async raw<T>(query: string, params?: unknown[]): Promise<Result<T>> {
    const factory = RAW_COMMAND_FACTORIES[query];
    if (!factory) {
      throw new NotSupportedByDBEngine(
        `DBS.raw: unknown DynamoDB operation "${query}". Supported: ${Object.keys(
          RAW_COMMAND_FACTORIES,
        ).join(", ")}.`,
      );
    }
    const input = params?.[0];
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new NotSupportedByDBEngine(
        `DBS.raw: DynamoDB ${query} requires a single plain-object input as params[0].`,
      );
    }
    try {
      const res = (await this._client.send(factory(input))) as Record<
        string,
        unknown
      >;
      // Best-effort uniform shape: rows = Items (Scan/Query) or [Item]
      // (GetItem) or []; rowCount mirrors what DynamoDB reports.
      const items =
        (res.Items as T[] | undefined) ?? (res.Item ? ([res.Item] as T[]) : []);
      const rowCount = (res.Count as number | undefined) ?? items.length;
      return { rows: items, rowCount };
    } catch (e) {
      this._log("Error in raw:", query, params, e);
      throw e;
    }
  }

  async shutdown(): Promise<void> {
    // DynamoDBDocumentClient wraps DynamoDBClient; destroying the document
    // client disposes the underlying raw client too.
    this._client.destroy();
  }
}

export default DBS;
