import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { PGConfig } from "./Config";

import { LogFunc } from "./types";
import {
  Id,
  Params,
  Order,
  Pagination,
  Result,
  GenericQuery,
} from "../generic";

type Operator =
  | "exists"
  | "any"
  | "in"
  | "notin"
  | "of"
  | "oftype"
  | "lte"
  | "lt"
  | "gte"
  | "gt"
  | "like"
  | "ilike"
  | "and";

import {
  UniqueConstraintViolation,
  ForeignKeyConstraintViolation,
  CheckConstraintViolation,
} from "../errors";

class Query extends GenericQuery {
  _dbs: Pool | PoolClient;
  _table: string;
  _counter: number;
  _config: PGConfig;
  _log: LogFunc;
  _fromQuery?: string;
  _params?: unknown[];

  constructor(
    pool: Pool | PoolClient,
    col: string,
    dbs: { config: PGConfig; log: LogFunc },
  ) {
    super();
    this._dbs = pool;
    this._table = col;
    this._counter = 1;
    this._config = dbs.config;
    this._log = (...ps) => dbs.log(...ps);
  }

  find(
    params: Params,
    limitOrPagination?: number | Pagination,
    offset?: number,
    order?: Order,
  ): this {
    let limit: number | undefined;
    let paginationOffset: number | undefined;
    let paginationOrder: Order | undefined;

    if (typeof limitOrPagination === "object" && limitOrPagination !== null) {
      limit = limitOrPagination.limit;
      paginationOffset = limitOrPagination.offset;
      paginationOrder = limitOrPagination.order;
    } else {
      limit = limitOrPagination;
      paginationOffset = offset;
      paginationOrder = order;
    }

    let q = `FROM "${this._table}" `;
    const newVals: unknown[] = [];
    q += this._buildWhere(params, newVals);
    if (paginationOrder) {
      q +=
        " ORDER BY" +
        paginationOrder
          .map((arr) => {
            this._checkKey(arr.key);
            if (arr.path) {
              const path = this._buildJsonPath(
                `"${arr.key}"`,
                arr.path || [],
                newVals,
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
      if (paginationOffset) {
        q += ` OFFSET $${this._counter++}`;
        newVals.push(paginationOffset);
      }
    }
    this._fromQuery = q;
    this._params = newVals;
    return this;
  }

  _buildWhere(params: Params, newVals: unknown[]) {
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
          } else if (typeof val === "object" && val !== null && "op" in val) {
            const filter = val as { op: Operator; val: unknown };
            return this._decideOperator(key, filter.op, filter.val, newVals);
          } else {
            throw new Error(
              `ERROR, unknown value type for key "${key}": ${val}`,
            );
          }
        })
        .join(" AND ")
    );
  }

  _buildJsonPath(
    key: string,
    path: string[],
    newVals: unknown[],
    keepAsJson = false,
  ) {
    if (path.length < 1) {
      throw new Error(
        "ERROR, JSON path requires at least one path element. You submitted [].",
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

  _checkKey(key: string) {
    if (/"/.test(key)) {
      throw new Error('Key must not contain double quotes (")');
    }
  }

  _decideOperator(
    key: string,
    op: Operator | string,
    val: unknown,
    newVals: unknown[],
    keyIsQuoted = false,
  ): string {
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
      case "in": {
        const arr = val as unknown[];
        if (arr.length === 0) {
          return " FALSE ";
        }
        arr.forEach((v) => newVals.push(v));
        return (
          `${key} IN (` + arr.map(() => `$${this._counter++}`).join(",") + ")"
        );
      }
      case "notin": {
        const arr = val as unknown[];
        if (arr.length === 0) {
          return " TRUE ";
        }
        arr.forEach((v) => newVals.push(v));
        return (
          `${key} NOT IN (` +
          arr.map(() => `$${this._counter++}`).join(",") +
          ")"
        );
      }
      case "of": {
        const ofVal = val as {
          path: string[];
          value: unknown;
          cast?: "string" | "number" | "boolean" | null;
        };
        const path = this._buildJsonPath(key, ofVal.path, newVals);
        if (typeof ofVal.value === "object" && ofVal.value !== null) {
          let castedPath = path;
          if (ofVal.cast) {
            castedPath = `(${path})::${
              ofVal.cast === "number"
                ? "double precision"
                : ofVal.cast === "boolean"
                  ? "bool"
                  : "text"
            }`;
          }
          const nested = ofVal.value as { op: Operator | string; val: unknown };
          return this._decideOperator(
            castedPath,
            nested.op,
            nested.val,
            newVals,
            true,
          );
        } else {
          newVals.push(ofVal.value);
          return `${path} = $${this._counter++}`;
        }
      }
      case "oftype": {
        const ofTypeVal = val as { path: string[]; value: string };
        const path = this._buildJsonPath(key, ofTypeVal.path, newVals, true);
        newVals.push(ofTypeVal.value);
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
        return (val as { op: Operator | string; val: unknown }[])
          .map((v) => this._decideOperator(key, v.op, v.val, newVals, true))
          .join(" AND ");
      default:
        throw new Error("ERROR, operator not implemented: " + op);
    }
  }

  findById(
    id: Params,
    limitOrPagination?: number | Pagination,
    offset?: number,
    order?: Order,
  ) {
    if (typeof limitOrPagination === "object" && limitOrPagination !== null) {
      return this.find(id, limitOrPagination);
    }
    return this.find(id, limitOrPagination, offset, order);
  }

  findByIds(
    ids: Params,
    limitOrPagination?: number | Pagination,
    offset?: number,
    order?: Order,
  ) {
    const params: Params = {};
    Object.keys(ids).forEach((key) => {
      const v = ids[key];
      if (Array.isArray(v)) {
        params[key] = { op: "in", val: v };
      } else {
        params[key] = v;
      }
    });

    if (typeof limitOrPagination === "object" && limitOrPagination !== null) {
      return this.find(params, limitOrPagination);
    }
    return this.find(params, limitOrPagination, offset, order);
  }

  async toArray<T>(): Promise<T[]> {
    const query = "SELECT * " + this._fromQuery;
    return this._dbs
      .query<QueryResultRow>(query, this._params || [])
      .then((res) => {
        return Promise.resolve(res.rows as T[]);
      })
      .catch((e) => {
        this._log("Error in toArray:", query, this._params || [], e);
        return Promise.reject(e);
      });
  }

  async count(): Promise<number> {
    const query = "SELECT COUNT(*) " + this._fromQuery;
    try {
      const result = await this._dbs.query<{ count: number }>(
        query,
        this._params || [],
      );
      return result.rows[0].count;
    } catch (e) {
      this._log("Error in count:", query, this._params || [], e);
      throw e;
    }
  }

  _transformArray(array: unknown[]) {
    if (this._config.arrayAsJSON) {
      return JSON.stringify(array);
    } else {
      return array;
    }
  }

  async insert(
    content: Record<string, unknown>[],
    returning: string[] = ["id"],
  ): Promise<Record<string, Id>[]> {
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
          ")",
      )
      .join(",");
    if (returning && returning.length > 0) {
      q += " RETURNING " + returning.map((r) => `"${r}"`).join(",");
    }
    const params: unknown[] = [];
    for (const c of content) {
      for (const k of keys) {
        const v = c[k];
        params.push(Array.isArray(v) ? this._transformArray(v) : v);
      }
    }
    return this._dbs
      .query(q, params)
      .then((res) => {
        return Promise.resolve(res.rows as Record<string, Id>[]);
      })
      .catch((err) => {
        if (err.code === "23505") {
          return Promise.reject(new UniqueConstraintViolation());
        }
        // 23503 (foreign key) and 23514 (check constraint) are grouped
        // on insert to preserve the legacy _code: 3 behavior.
        if (err.code === "23503" || err.code === "23514") {
          return Promise.reject(new CheckConstraintViolation());
        }
        this._log("Error in insert:", q, params, err);
        return Promise.reject(err);
      });
  }

  async updateOne<T>(
    filter: Params,
    c: Record<string, unknown>,
  ): Promise<Result<T>> {
    return this.update<T>(filter, c);
  }

  async update<T>(
    filter: Params,
    c: Record<string, unknown>,
  ): Promise<Result<T>> {
    let q = `UPDATE "${this._table}" SET `;
    const keys = Object.keys(c);
    if (keys.length > 1) {
      q += "(" + keys.map((k) => `"${k}"`).join(",") + ") = ";
      q += "(" + keys.map(() => `$${this._counter++}`).join(",") + ")";
    } else {
      q += keys.map((k) => `"${k}"`) + " = ";
      q += keys.map(() => `$${this._counter++}`);
    }
    const newVals: unknown[] = [];
    q += " " + this._buildWhere(filter, newVals);
    const vals: unknown[] = keys
      .map((k) => {
        const v = c[k];
        return Array.isArray(v) ? this._transformArray(v) : v;
      })
      .concat(newVals);
    try {
      const res = await this._dbs.query<QueryResultRow>(q, vals);
      return { rows: res.rows as T[], rowCount: res.rowCount };
    } catch (e) {
      if ((e as { code: string }).code === "23505") {
        return Promise.reject(
          new UniqueConstraintViolation("ERROR, tried to update, not unique"),
        );
      }

      this._log("Error in update:", q, vals, e);
      throw e;
    }
  }

  async remove<T>(params: Params): Promise<Result<T>> {
    let q = `DELETE FROM "${this._table}" `;
    const newVals: unknown[] = [];
    q += this._buildWhere(params, newVals);
    try {
      const res = await this._dbs.query<QueryResultRow>(q, newVals);
      return { rows: res.rows as T[], rowCount: res.rowCount };
    } catch (err) {
      if ((err as { code: string }).code === "23503") {
        return Promise.reject(new ForeignKeyConstraintViolation());
      }
      this._log("Error in remove:", q, newVals, err);
      throw err;
    }
  }

  async drop(): Promise<QueryResult> {
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
