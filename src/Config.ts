import { PGConfig } from "./postgresql/Config";
import { DynamoConfig } from "./dynamodb/Config";

interface Config {
  use: string;
  postgresql?: PGConfig;
  dynamodb?: DynamoConfig;
}

export type { PGConfig, DynamoConfig };
export default Config;
