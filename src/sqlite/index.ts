"use strict";

import { GenericDBS, Result, Id } from "../generic";
import { GenericQuery } from "../generic/GenericQuery";
import { GenericTransaction } from "../generic/GenericTransaction";

export type SqliteConfig = {
  filename: string;
};

class SqliteDBS extends GenericDBS {
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
  async raw<T>(_query: string, _params?: unknown[]): Promise<Result<T>> {
    throw new Error("SqliteDBS.raw not implemented");
  }
  async shutdown(): Promise<void> {
    throw new Error("SqliteDBS.shutdown not implemented");
  }
}

export const connectSqlite = async (_c: SqliteConfig): Promise<SqliteDBS> => {
  throw new Error("connectSqlite not implemented");
};

export { SqliteDBS };
