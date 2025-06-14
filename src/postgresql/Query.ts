import { Pool, PoolClient } from "pg";
import { PGConfig } from "./Config";

import { LogFunc } from "./types";
import { Params, Order, Result, GenericQuery } from "../generic";

class Query extends GenericQuery {
  _dbs: Pool | PoolClient;
  _table: string;
  _counter: number;
  _config: PGConfig;
  _log: LogFunc;
  _fromQuery?: string;
  _params?: any[];

  constructor(
    pool: Pool | PoolClient,
    col: string,
    dbs: { config: PGConfig; log: LogFunc }
  ) {
    super();
    this._dbs = pool;
    this._table = col;
    this._counter = 1;
    this._config = dbs.config;
    this._log = (...ps) => dbs.log(...ps);
  }

  find(params: Params, limit?: number, offset?: number, order?: Order): this {
    let q = `FROM "${this._table}" `;
    const newVals = [];
    q += this._buildWhere(params, newVals);
    if (order) {
      q +=
        " ORDER BY" +
        order
          .map((arr) => {
            this._checkKey(arr.key);
            if (arr.path) {
              const path = this._buildJsonPath(
                `"${arr.key}"`,
                arr.path || [],
                newVals
              );
              return ` ${path} ${arr.dir === "ASC" ? "ASC" : "DESC"} `;
            } else {
              return ` "${arr.key}" ${arr.dir === "ASC" ? "ASC" : "DESC"} `;
            }
          })
          .join(" , ");
    }
    if (limit) {
      q += ` LIMIT $${this._counter++}`;
      newVals.push(limit);
      if (offset) {
        q += ` OFFSET $${this._counter++}`;
        newVals.push(offset);
      }
    }
    this._fromQuery = q;
    this._params = newVals;
    return this;
  }

  _buildWhere(params: Params, newVals: any[]) {
    const keys = Object.keys(params);
    if (keys.length === 0) {
      return "";
    }
    const vals = keys.map((key) => params[key]);
    return (
      "WHERE " +
      keys
        .map((key, i) => {
          const val = vals[i];
          if (val === null) {
            return `"${key}" IS NULL `;
          } else if (typeof val !== "object") {
            newVals.push(val);
            return `"${key}" = $${this._counter++}`;
          } else if (typeof val === "object" && "op" in val) {
            const op = val.op;
            return this._decideOperator(key, op, val.val, newVals);
          } else {
            throw new Error(
              `ERROR, unknown value type for key "${key}": ${val}`
            );
          }
        })
        .join(" AND ")
    );
  }

  _buildJsonPath(key, path, newVals, keepAsJson = false) {
    if (path.length < 1) {
      throw new Error(
        "ERROR, JSON path requires at least one path element. You submitted []."
      );
    }

    path.forEach((v) => newVals.push(v));

    return (
      `${key}` +
      (path.length === 1
        ? ""
        : "->" +
          path
            .slice(0, -1)
            .map(() => `$${this._counter++}`)
            .join("->")) +
      (keepAsJson ? "->" : "->>") +
      `$${this._counter++} `
    );
  }

  _checkKey(key) {
    if (/"/.test(key)) {
      throw 'Key must not contain "!';
    }
  }

  _decideOperator(
    key: string,
    op: string,
    val: any,
    newVals: any[],
    keyIsQuoted = false
  ) {
    if (!keyIsQuoted) {
      this._checkKey(key);
      key = `"${key}"`;
    }
    switch (op) {
      case "exists":
        return `${key} IS ${val === true ? "NOT" : ""} NULL `;
      case "any":
        newVals.push(val);
        return `$${this._counter++} = ANY(${key})`;
      case "in":
        if (val.length === 0) {
          return " FALSE ";
        }
        val.forEach((v: any) => newVals.push(v));
        return (
          `${key} IN (` + val.map(() => `$${this._counter++}`).join(",") + ")"
        );
      case "of": {
        const path = this._buildJsonPath(key, val.path, newVals);
        if (typeof val.value === "object") {
          let castedPath = path;
          if (val.cast) {
            castedPath = `(${path})::${
              val.cast === "number"
                ? "double precision"
                : val.value.cast === "boolean"
                ? "bool"
                : "text"
            }`;
          }
          return this._decideOperator(
            castedPath,
            val.value.op,
            val.value.val,
            newVals,
            true
          );
        } else {
          newVals.push(val.value);
          return `${path} = $${this._counter++}`;
        }
      }
      case "oftype": {
        const path = this._buildJsonPath(key, val.path, newVals, true);
        newVals.push(val.value);
        return `jsonb_typeof(${path}) = $${this._counter++}`;
      }
      case "lte":
        newVals.push(val);
        return `${key} <= $${this._counter++}`;
      case "lt":
        newVals.push(val);
        return `${key} < $${this._counter++}`;
      case "gte":
        newVals.push(val);
        return `${key} >= $${this._counter++}`;
      case "gt":
        newVals.push(val);
        return `${key} > $${this._counter++}`;
      case "like":
        newVals.push(val);
        return `${key} LIKE $${this._counter++}`;
      case "ilike":
        newVals.push(val);
        return `${key} ILIKE $${this._counter++}`;
      case "and":
        return (val as { op: string; val: any }[])
          .map((v) => this._decideOperator(key, v.op, v.val, newVals, true))
          .join(" AND ");
      default:
        throw new Error("ERROR, operator not implemented: " + op);
    }
  }

  findById(id: Params, limit?: number, offset?: number, order?: Order) {
    return this.find(id, limit, offset, order);
  }

  findByIds(ids: Params, limit?: number, offset?: number, order?: Order) {
    const params = {};
    Object.keys(ids).forEach((key) => {
      if (Array.isArray(ids[key])) {
        params[key] = { op: "in", val: ids[key] };
      } else {
        params[key] = ids[key];
      }
    });

    return this.find(params, limit, offset, order);
  }

  async toArray<T>(): Promise<T[]> {
    const query = "SELECT * " + this._fromQuery;
    return this._dbs
      .query<T>(query, this._params)
      .then((res) => {
        return Promise.resolve(res.rows);
      })
      .catch((e) => {
        this._log("Error in toArray:", query, this._params, e);
        return Promise.reject(e);
      });
  }

  async count(): Promise<number> {
    const query = "SELECT COUNT(*) " + this._fromQuery;
    try {
      const result = await this._dbs.query<{ count: number }>(
        query,
        this._params
      );
      return result.rows[0].count;
    } catch (e) {
      this._log("Error in count:", query, this._params, e);
      throw e;
    }
  }

  _transformArray(array: any[]) {
    if (this._config.arrayAsJSON) {
      return JSON.stringify(array);
    } else {
      return array;
    }
  }

  async insert(content: any[], returning = ["id"]) {
    if (content.length === 0) {
      return Promise.resolve([]);
    }
    let q = `INSERT INTO "${this._table}" `;
    const keys = Object.keys(content[0]);
    q += "(" + keys.map((key) => `"${key}"`).join(",") + ")";
    q += " VALUES ";
    q += content
      .map(
        (_, i) =>
          "(" +
          keys.map((_, j) => `$${i * keys.length + (j + 1)}`).join(",") +
          ")"
      )
      .join(",");
    if (returning && returning.length > 0) {
      q += " RETURNING " + returning.map((r) => `"${r}"`).join(",");
    }
    const params = [].concat(
      ...content.map((c) =>
        keys.map((k) =>
          Array.isArray(c[k]) ? this._transformArray(c[k]) : c[k]
        )
      )
    );
    return this._dbs
      .query(q, params)
      .then((res) => {
        return Promise.resolve(res.rows);
      })
      .catch((err) => {
        if (err.code === "23505") {
          return Promise.reject({
            msg: "ERROR, tried to insert, not unique",
            _code: 1,
          });
        } else if (err.code === "23503" || err.code === "23514") {
          return Promise.reject({
            msg: "ERROR, tried to insert, constraints not met",
            _code: 3,
          });
        } else {
          this._log("Error in insert:", q, params, err);
          return Promise.reject(err);
        }
      });
  }

  async updateOne(filter: Params, c: { [p: string]: any }) {
    return this.update(filter, c);
  }

  async update(filter: Params, c: { [p: string]: any }) {
    let q = `UPDATE "${this._table}" SET `;
    const keys = Object.keys(c);
    if (keys.length > 1) {
      q += "(" + keys.map((k) => `"${k}"`).join(",") + ") = ";
      q += "(" + keys.map(() => `$${this._counter++}`).join(",") + ")";
    } else {
      q += keys.map((k) => `"${k}"`) + " = ";
      q += keys.map(() => `$${this._counter++}`);
    }
    const newVals = [];
    q += " " + this._buildWhere(filter, newVals);
    const vals = keys
      .map((k) => (Array.isArray(c[k]) ? this._transformArray(c[k]) : c[k]))
      .concat(newVals);
    try {
      return await this._dbs.query(q, vals);
    } catch (e) {
      if ((e as { code: string }).code === "23505") {
        return Promise.reject({
          msg: "ERROR, tried to update, not unique",
          _code: 1,
        });
      }

      this._log("Error in updateOne:", q, vals, e);
      throw e;
    }
  }

  async remove<T>(params: Params): Promise<Result<T>> {
    let q = `DELETE FROM "${this._table}" `;
    const newVals = [];
    q += this._buildWhere(params, newVals);
    try {
      return await this._dbs.query(q, newVals);
    } catch (err) {
      if ((err as { code: string }).code === "23503") {
        return Promise.reject({
          msg: "ERROR, tried to remove item that is still a reference",
          _code: 2,
        });
      } else {
        this._log("Error in remove:", q, newVals, err);
        throw err;
      }
    }
  }

  async drop() {
    const q = `DROP TABLE "${this._table}"`;
    try {
      return await this._dbs.query(q);
    } catch (e) {
      this._log("Error in drop:", q, null, e);
      throw e;
    }
  }
}

export default Query;
