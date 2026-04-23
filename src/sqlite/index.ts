"use strict";

import Database from "better-sqlite3";

import { SqliteConfig } from "./Config";
import DBS from "./DBS";

export const connectSqlite = async (c: SqliteConfig): Promise<DBS> => {
  const opts: Database.Options = {};
  if (c.readonly !== undefined) opts.readonly = c.readonly;
  if (c.fileMustExist !== undefined) opts.fileMustExist = c.fileMustExist;
  if (c.timeout !== undefined) opts.timeout = c.timeout;
  const db = new Database(c.filename, opts);
  return new DBS(db, c);
};

export { DBS };
export { SqliteConfig };
