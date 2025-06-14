import { Pool } from "pg";
import { PGConfig } from "./Config";

import { Queriable } from "./Queriable";

import Query from "./Query";
import Transaction from "./Transaction";
import { GenericDBS } from "../generic";

class DBS extends Queriable implements GenericDBS {
  _dbs: Pool;
  _config: PGConfig;

  constructor(dbs: Pool, config: PGConfig) {
    super();
    this._dbs = dbs;
    this._config = config;
  }

  /* DBS FUNCTIONS */
  collection(col: string) {
    return new Query(this._dbs, col, {
      config: this._config,
      log: (...ps) => this._log(...ps),
    });
  }

  async transaction<T>(fn: (t: Transaction) => Promise<T>) {
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
  createCollection(
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
    prefix?: string
  ) {
    if (prefix) {
      prefix += "_";
    } else {
      prefix = "";
    }
    let q = `CREATE TABLE "${name}" (`;
    q += []
      .concat(
        // fields
        fields.map((f) => {
          let res = `"${f.name}" ${f.type}`;
          if (f.notNull) {
            res += " NOT NULL";
          }
          if (f.default !== undefined) {
            res += " DEFAULT " + f.default;
          }
          return res;
        }),
        // constraints
        indexes
          .filter((i) => i.key)
          .map(
            (i) =>
              `CONSTRAINT "${name}_${i.name}_pkey" PRIMARY KEY (` +
              i.key.map((k) => `"${k}"`).join(",") +
              ")"
          ),
        indexes
          .filter((i) => i.unique)
          .map((i) => `CONSTRAINT "${name}_${i.name}_u" UNIQUE ("${i.name}")`),
        indexes
          .filter((i) => i.foreign)
          .map(
            (i) =>
              `CONSTRAINT "${name}_${i.name}_fkey" FOREIGN KEY ` +
              `("${i.name}") REFERENCES "${i.foreign.table}" ` +
              `(${i.foreign.field}) MATCH SIMPLE`
          )
      )
      .join(",");
    // with
    q += ") WITH ( OIDS = FALSE )";
    try {
      return this._dbs.query(q);
    } catch (e) {
      this._log("Error in updateOne:", "", {}, e);
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

  async raw(query: string, params: any[] = []) {
    try {
      return await this._dbs.query(query, params);
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
