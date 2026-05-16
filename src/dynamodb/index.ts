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
  const hasAccessKey = Boolean(c.accessKeyId);
  const hasSecretKey = Boolean(c.secretAccessKey);
  if (hasAccessKey !== hasSecretKey) {
    throw new Error(
      "DynamoConfig: both accessKeyId and secretAccessKey must be provided together, or neither (to use the AWS default credential chain)."
    );
  }
  if (hasAccessKey && hasSecretKey) {
    clientConfig.credentials = {
      accessKeyId: c.accessKeyId as string,
      secretAccessKey: c.secretAccessKey as string,
      sessionToken: c.sessionToken,
    };
  }
  return new DynamoDBClient(clientConfig);
};

export const connectDynamo = async (c: DynamoConfig): Promise<DBS> => {
  const raw = createClient(c);
  // convertClassInstanceToMap was previously `true`, which strips `Date`
  // instances (and any class with no own enumerable properties) to `{}` on
  // write. Leave it off: callers should serialize Dates themselves (ISO
  // strings, epoch ms, ...) and the driver will round-trip them verbatim.
  const doc = DynamoDBDocumentClient.from(raw, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });
  return new DBS(doc, raw, c);
};

export { DBS };
export type { DynamoConfig };
