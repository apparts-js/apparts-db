import { connectPG } from "./postgresql";
import Config from "./Config";

export async function connect(c: Config) {
  if (c.use && ["postgresql"].indexOf(c.use) !== -1) {
    const pool = await connectPG(c[c.use]);
    return pool;
  } else {
    throw "Config references DB-engine that does not exist: " + c.use;
  }
}

/*here we need more stuff like
  - createPool
  - closePool
  - newTransaction
*/
