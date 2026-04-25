import { PGConfig } from "./postgresql/Config";
import { DynamoConfig } from "./dynamodb/Config";
import { SqliteConfig } from "./sqlite/Config";

interface Config {
  use: string;
  postgresql?: PGConfig;
  dynamodb?: DynamoConfig;
  sqlite?: SqliteConfig;
}

export { PGConfig, DynamoConfig, SqliteConfig };
export default Config;
