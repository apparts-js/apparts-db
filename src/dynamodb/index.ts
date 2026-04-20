"use strict";

import { DynamoDBClient, DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { DynamoConfig } from "./Config";
import DBS from "./DBS";

export const createClient = (c: DynamoConfig): DynamoDBClient => {
  const clientConfig: DynamoDBClientConfig = {
    region: c.region,
  };
  if (c.endpoint) {
    clientConfig.endpoint = c.endpoint;
  }
  if (c.accessKeyId && c.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: c.accessKeyId,
      secretAccessKey: c.secretAccessKey,
      sessionToken: c.sessionToken,
    };
  }
  return new DynamoDBClient(clientConfig);
};

export const connectDynamo = async (c: DynamoConfig): Promise<DBS> => {
  const raw = createClient(c);
  const doc = DynamoDBDocumentClient.from(raw, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
  });
  return new DBS(doc, raw, c);
};

export { DBS };
export { DynamoConfig };
