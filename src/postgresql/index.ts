"use strict";

import { PGConfig } from "./Config";
import { Pool, types as pgTypes, defaults as pgDefaults } from "pg";
import DBS from "./DBS";

export const createPool = async (c: PGConfig) => {
  const pool = new Pool({
    host: c.host,
    port: c.port,
    user: c.user,
    password: c.pw,
    database: c.db,
    max: c.maxPoolSize || 10,
    connectionTimeoutMillis: c.connectionTimeoutMillis || 0,
    idleTimeoutMillis: c.idleTimeoutMillis || 10000,
  });

  pool.on("error", (err) => {
    // What to do?
    console.log(
      `Postgres DB-connection failed for host ${c.host}:${c.port},` +
        ` ${c.user}@${c.db} with ERROR: ${err}`
    );
    throw err;
  });

  if (c.bigIntAsNumber) {
    // Return Bigint and stuff as number, not as string
    pgDefaults.parseInt8 = true;
  }

  return pool;
};

export const connectPG = async (c: PGConfig) => {
  const pool = await createPool(c);
  return new DBS(pool, c);
};

/*export const createTransaction = async (c: PGConfig) => {
  const pool = await createPool(c);
  const client = pool.connect();
  return new DBS(client, c);
};
*/
