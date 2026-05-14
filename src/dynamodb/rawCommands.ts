import {
  BatchGetCommand,
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

// Whitelist of DynamoDB DocumentClient operations that DBS.raw /
// Transaction.raw forward. Inputs are typed as the SDK's
// InputType-erased shape (any) since the caller is already reaching
// for the escape hatch — they are responsible for shaping the request
// correctly per the AWS SDK docs.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const RAW_COMMAND_FACTORIES: Record<string, (input: any) => any> = {
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

export const RAW_OPERATIONS = Object.keys(RAW_COMMAND_FACTORIES);
