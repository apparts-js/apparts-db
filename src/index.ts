"use strict";
import { connectPG} from "./postgresql";
import Config from "./Config";
import DBS from "./postgresql/DBS";

export function connect(
  c: Config,
  next: (error: boolean | any, dbs?: DBS) => void
) {
  if (c.use && ["postgresql"].indexOf(c.use) !== -1) {
    connectPG(c[c.use], next);
  } else {
    throw "Config references DB-engine that does not exist: " + c.use;
  }
}

here we need more stuff like
  - createPool
  - closePool
  - newTransaction
