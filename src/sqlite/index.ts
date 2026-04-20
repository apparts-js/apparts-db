"use strict";

import Database from "better-sqlite3";

import { GenericDBS, Result, Id } from "../generic";
import { GenericQuery } from "../generic/GenericQuery";
import { GenericTransaction } from "../generic/GenericTransaction";

export type SqliteConfig = {
  filename: string;
  readonly?: boolean;
  fileMustExist?: boolean;
};

class SqliteDBS extends GenericDBS {
  _db: Database.Database;

  constructor(db: Database.Database) {
    super();
    this._db = db;
  }

  newId(): Id {
    throw new Error("SqliteDBS.newId not implemented");
  }
  fromId(_id: Id): Id {
    throw new Error("SqliteDBS.fromId not implemented");
  }
  toId(_id: Id): Id {
    throw new Error("SqliteDBS.toId not implemented");
  }
  collection(_col: string): GenericQuery {
    throw new Error("SqliteDBS.collection not implemented");
  }
  async transaction<T>(
    _fn: (t: GenericTransaction) => Promise<T>
  ): Promise<T> {
    throw new Error("SqliteDBS.transaction not implemented");
  }

  async raw<T>(query: string, params: unknown[] = []): Promise<Result<T>> {
    const stmt = this._db.prepare(query);
    if (stmt.reader) {
      const rows = stmt.all(...(params as never[])) as T[];
      return { rows, rowCount: rows.length };
    }
    const info = stmt.run(...(params as never[]));
    return { rows: [], rowCount: info.changes };
  }

  async shutdown(): Promise<void> {
    this._db.close();
  }
}

export const connectSqlite = async (c: SqliteConfig): Promise<SqliteDBS> => {
  const opts: Database.Options = {};
  if (c.readonly !== undefined) opts.readonly = c.readonly;
  if (c.fileMustExist !== undefined) opts.fileMustExist = c.fileMustExist;
  const db = new Database(c.filename, opts);
  return new SqliteDBS(db);
};

export { SqliteDBS };
