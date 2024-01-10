import { PGConfig } from "./postgresql/Config";

interface Config {
  use: string;
  postgresql: PGConfig;
}

export { PGConfig };
export default Config;
