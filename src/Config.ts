import { PGConfig } from "./postgresql/Config";
import { DynamoConfig } from "./dynamodb/Config";

interface Config {
  use: string;
  postgresql?: PGConfig;
  dynamodb?: DynamoConfig;
}

export { PGConfig, DynamoConfig };
export default Config;
