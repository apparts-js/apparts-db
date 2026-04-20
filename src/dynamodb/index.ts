"use strict";

import { DynamoConfig } from "./Config";
import DBS from "./DBS";

export const connectDynamo = async (_c: DynamoConfig): Promise<DBS> => {
  throw new Error("Not yet implemented: connectDynamo");
};

export { DBS };
export { DynamoConfig };
