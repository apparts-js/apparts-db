import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
} from "@aws-sdk/client-dynamodb";

import { connectDynamo, DynamoConfig } from "../dynamodb";

const buildConfig = (): DynamoConfig => ({
  region: "local",
  endpoint: `http://${process.env.DYNAMODB_HOST || "localhost"}:${
    process.env.DYNAMODB_PORT || "8000"
  }`,
  accessKeyId: "local",
  secretAccessKey: "local",
});

const rawClient = () =>
  new DynamoDBClient({
    region: "local",
    endpoint: `http://${process.env.DYNAMODB_HOST || "localhost"}:${
      process.env.DYNAMODB_PORT || "8000"
    }`,
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });

export const ensureTable = async (tableName: string) => {
  const client = rawClient();
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    await client.send(new DeleteTableCommand({ TableName: tableName }));
  } catch (e) {
    if (!(e instanceof ResourceNotFoundException)) {
      client.destroy();
      throw e;
    }
  }
  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    })
  );
  client.destroy();
};

export const dropTable = async (tableName: string) => {
  const client = rawClient();
  try {
    await client.send(new DeleteTableCommand({ TableName: tableName }));
  } catch (e) {
    if (!(e instanceof ResourceNotFoundException)) {
      client.destroy();
      throw e;
    }
  }
  client.destroy();
};

export const setupDbs = async () => {
  return connectDynamo(buildConfig());
};
