import { PGConfig } from "./postgresql/Config";

interface Config {
  use: string;
  postgresql: PGConfig;
}

export type { PGConfig };
export default Config;
