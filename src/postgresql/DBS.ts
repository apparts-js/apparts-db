import { Pool, QueryResultRow } from "pg";
import { PGConfig } from "./Config";

import { Queriable } from "./Queriable";

import Query from "./Query";
import Transaction from "./Transaction";
import {
  Capabilities,
  GenericDBS,
  GenericQuery,
  GenericTransaction,
  Result,
} from "../generic";

class DBS extends Queriable implements GenericDBS {
  _dbs: Pool;
  _config: PGConfig;

  constructor(dbs: Pool, config: PGConfig) {
    super();
    this._dbs = dbs;
    this._config = config;
  }

  getCapabilities(): Capabilities {
    return {
      filter: {
        eq: true,
        null: true,
        in: true,
        notin: true,
        gt: true,
        gte: true,
        lt: true,
        lte: true,
        exists: true,
        and: true,
        like: true,
        ilike: true,
        jsonPath: true,
        jsonType: true,
      },
      pagination: {
        limit: true,
        offset: true,
        cursor: false,
        order: true,
      },
      mutation: {
        insert: true,
        insertBatchAtomic: true,
        upsert: false,
        updateByFilter: true,
        removeByFilter: true,
      },
      count: true,
      transaction: true,
      drop: true,
    };
  }

  /* DBS FUNCTIONS */
  collection(col: string): GenericQuery {
    return new Query(this._dbs, col, {
      config: this._config,
      log: (...ps) => this._log(...ps),
    });
  }

  async transaction<T>(fn: (t: GenericTransaction) => Promise<T>) {
    const client = await this._dbs.connect();
    const transaction = new Transaction(client, {
      config: this._config,
    });
    try {
      const result = await fn(transaction);
      await transaction.commit();
      return result;
    } catch (e) {
      await transaction.rollback();
      throw e;
    } finally {
      await transaction.end();
    }
  }

  /**
   *
   * @param string name
   * @param [{}] indexes with { name: <field>, key: [<key1>, ...] }
   *                       or { name: <field>, unique: true }
   *                       or { name: <field>, foreign:
   *                                             { table: <table>,
   *                                               field: <field>} }
   * @param [{}] fields with { name: <name>, type: <type>, notNull:
   *                           <true/false>, default: <defaultVal> }
   * @returns Promise
   */
  async createCollection(
    name: string,
    indexes: {
      key?: string[];
      name: string;
      unique?: boolean;
      foreign?: { table: string; field: string };
    }[],
    fields: {
      name: string;
      type: string;
      notNull?: boolean;
      default?: string;
    }[],
    prefix?: string,
  ) {
    if (prefix) {
      prefix += "_";
    } else {
      prefix = "";
    }
    let q = `CREATE TABLE "${name}" (`;
    const parts: string[] = [
      ...fields.map((f) => {
        let res = `"${f.name}" ${f.type}`;
        if (f.notNull) {
          res += " NOT NULL";
        }
        if (f.default !== undefined) {
          res += " DEFAULT " + f.default;
        }
        return res;
      }),
      ...indexes
        .filter((i): i is typeof i & { key: string[] } => i.key !== undefined)
        .map(
          (i) =>
            `CONSTRAINT "${name}_${i.name}_pkey" PRIMARY KEY (` +
            i.key.map((k) => `"${k}"`).join(",") +
            ")",
        ),
      ...indexes
        .filter((i) => i.unique)
        .map((i) => `CONSTRAINT "${name}_${i.name}_u" UNIQUE ("${i.name}")`),
      ...indexes
        .filter(
          (i): i is typeof i & { foreign: { table: string; field: string } } =>
            i.foreign !== undefined,
        )
        .map(
          (i) =>
            `CONSTRAINT "${name}_${i.name}_fkey" FOREIGN KEY ` +
            `("${i.name}") REFERENCES "${i.foreign.table}" ` +
            `(${i.foreign.field}) MATCH SIMPLE`,
        ),
    ];
    q += parts.join(",");
    // with
    q += ") WITH ( OIDS = FALSE )";
    try {
      return await this._dbs.query(q);
    } catch (e) {
      this._log("Error in createCollection:", q, [], e);
      throw e;
    }
  }

  convertType(type: { type: string; maxLength?: boolean; auto?: boolean }) {
    switch (type.type) {
      case "int":
        return "integer";
      case "id":
        if (this._config.idsAsBigInt) {
          return type.auto ? "bigserial" : "bigint";
        } else {
          return type.auto ? "serial" : "integer";
        }
      case "bool":
        return "boolean";
      case "float":
        return "double precision";
      case "/":
      case "string":
      case "hex":
      case "base64":
      case "email":
      case "password":
        return type.maxLength ? `varchar(${type.maxLength})` : "text";
      case "time":
        return "bigint";
      case "array_time":
        return "bigint[]";
      case "array_bigint":
        return "bigint[]";
      case "array_id":
        if (this._config.idsAsBigInt) {
          return "bigint[]";
        } else {
          return "integer[]";
        }
    }
    throw new Error("ERROR: Type not found: " + JSON.stringify(type));
  }

  async raw<T>(query: string, params: unknown[] = []): Promise<Result<T>> {
    try {
      const res = await this._dbs.query<QueryResultRow>(query, params);
      return { rows: res.rows as T[], rowCount: res.rowCount };
    } catch (e) {
      this._log("Error in dbs.raw", query, { params }, e);
      throw e;
    }
  }

  async shutdown() {
    return new Promise<void>((res) => {
      this._dbs.end(() => {
        res();
      });
    });
  }

  /* END DBS FUNCTIONS */
}

export default DBS;
