import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from "@aws-sdk/client-dynamodb";

import { connectDynamo, DynamoConfig } from "../dynamodb";

export const buildConfig = (): DynamoConfig => {
  if (process.env.DYNAMODB_TEST_CONFIG) {
    return JSON.parse(
      Buffer.from(process.env.DYNAMODB_TEST_CONFIG, "base64").toString("utf-8")
    );
  }
  return {
    region: "local",
    endpoint: `http://${process.env.DYNAMODB_HOST || "localhost"}:${
      process.env.DYNAMODB_PORT || "8000"
    }`,
    accessKeyId: "local",
    secretAccessKey: "local",
  };
};

const rawClient = () =>
  new DynamoDBClient({
    region: "local",
    endpoint: `http://${process.env.DYNAMODB_HOST || "localhost"}:${
      process.env.DYNAMODB_PORT || "8000"
    }`,
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });

const WAIT_SECONDS = 30;

export const ensureTable = async (tableName: string) => {
  const client = rawClient();
  try {
    try {
      await client.send(new DescribeTableCommand({ TableName: tableName }));
      await client.send(new DeleteTableCommand({ TableName: tableName }));
      await waitUntilTableNotExists(
        { client, maxWaitTime: WAIT_SECONDS },
        { TableName: tableName }
      );
    } catch (e) {
      if (!(e instanceof ResourceNotFoundException)) throw e;
    }
    await client.send(
      new CreateTableCommand({
        TableName: tableName,
        AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
        BillingMode: "PAY_PER_REQUEST",
      })
    );
    await waitUntilTableExists(
      { client, maxWaitTime: WAIT_SECONDS },
      { TableName: tableName }
    );
  } finally {
    client.destroy();
  }
};

export const dropTable = async (tableName: string) => {
  const client = rawClient();
  try {
    try {
      await client.send(new DeleteTableCommand({ TableName: tableName }));
    } catch (e) {
      if (!(e instanceof ResourceNotFoundException)) throw e;
      return;
    }
    await waitUntilTableNotExists(
      { client, maxWaitTime: WAIT_SECONDS },
      { TableName: tableName }
    );
  } finally {
    client.destroy();
  }
};

export const setupDbs = async () => {
  return connectDynamo(buildConfig());
};
