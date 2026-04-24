import Database from "better-sqlite3";

import { GenericQuery, Id, Order, Params, Result } from "../generic";
import { SqliteConfig } from "./Config";
import { LogFunc } from "./types";

const checkKey = (key: string): void => {
  if (/"/.test(key)) {
    throw 'Key must not contain "!';
  }
};

const SQLITE_UNIQUE_CODES = new Set([
  "SQLITE_CONSTRAINT_PRIMARYKEY",
  "SQLITE_CONSTRAINT_UNIQUE",
]);

const SQLITE_FK_CODES = new Set([
  "SQLITE_CONSTRAINT_FOREIGNKEY",
  "SQLITE_CONSTRAINT_CHECK",
  "SQLITE_CONSTRAINT_NOTNULL",
]);

class Query extends GenericQuery {
  _db: Database.Database;
  _table: string;
  _config: SqliteConfig;
  _log: LogFunc;
  _fromQuery?: string;
  _params?: unknown[];

  constructor(
    db: Database.Database,
    table: string,
    dbs: { config: SqliteConfig; log: LogFunc }
  ) {
    super();
    this._db = db;
    this._table = table;
    this._config = dbs.config;
    this._log = (...ps) => dbs.log(...ps);
  }

  find(params: Params, limit?: number, offset?: number, order?: Order): this {
    checkKey(this._table);
    const vals: unknown[] = [];
    let q = `FROM "${this._table}" `;
    q += this._buildWhere(params, vals);
    if (order && order.length > 0) {
      q +=
        " ORDER BY" +
        order
          .map((arr) => {
            checkKey(arr.key);
            const col = arr.path
              ? this._buildJsonPath(`"${arr.key}"`, arr.path)
              : `"${arr.key}"`;
            return ` ${col} ${arr.dir === "ASC" ? "ASC" : "DESC"} `;
          })
          .join(" , ");
    }
    if (limit) {
      q += ` LIMIT ?`;
      vals.push(limit);
      if (offset) {
        q += ` OFFSET ?`;
        vals.push(offset);
      }
    }
    this._fromQuery = q;
    this._params = vals;
    return this;
  }

  findById(id: Params, limit?: number, offset?: number, order?: Order): this {
    return this.find(id, limit, offset, order);
  }

  findByIds(ids: Params, limit?: number, offset?: number, order?: Order): this {
    const params: Params = {};
    for (const key of Object.keys(ids)) {
      const v = ids[key];
      if (Array.isArray(v)) {
        params[key] = {
          op: "in",
          val: v as (string | number | boolean | null)[],
        };
      } else {
        params[key] = v;
      }
    }
    return this.find(params, limit, offset, order);
  }

  _buildWhere(params: Params, vals: unknown[]): string {
    const keys = Object.keys(params);
    if (keys.length === 0) return "";
    return (
      "WHERE " +
      keys
        .map((key) => {
          checkKey(key);
          const val = params[key];
          if (val === null) {
            return `"${key}" IS NULL `;
          }
          if (typeof val !== "object") {
            vals.push(val);
            return `"${key}" = ?`;
          }
          if (Array.isArray(val)) {
            if (val.length === 0) return " 0 ";
            val.forEach((v) => vals.push(v));
            return `"${key}" IN (` + val.map(() => "?").join(",") + ")";
          }
          if (!("op" in val)) {
            throw new Error(
              `ERROR, unknown value type for key "${key}". Expected primitive, null, array, or operator object { op, val }.`
            );
          }
          return this._decideOperator(
            `"${key}"`,
            (val as { op: string; val: unknown }).op,
            (val as { op: string; val: unknown }).val,
            vals
          );
        })
        .join(" AND ")
    );
  }

  _decideOperator(
    key: string,
    op: string,
    val: unknown,
    vals: unknown[]
  ): string {
    switch (op) {
      case "exists":
        return `${key} IS ${val === true ? "NOT" : ""} NULL `;
      case "in": {
        const arr = val as (string | number | boolean | null)[];
        if (arr.length === 0) return " 0 ";
        arr.forEach((v) => vals.push(v));
        return `${key} IN (` + arr.map(() => "?").join(",") + ")";
      }
      case "notin": {
        const arr = val as (string | number | boolean | null)[];
        if (arr.length === 0) return " 1 ";
        arr.forEach((v) => vals.push(v));
        return `${key} NOT IN (` + arr.map(() => "?").join(",") + ")";
      }
      case "lte":
        vals.push(val);
        return `${key} <= ?`;
      case "lt":
        vals.push(val);
        return `${key} < ?`;
      case "gte":
        vals.push(val);
        return `${key} >= ?`;
      case "gt":
        vals.push(val);
        return `${key} > ?`;
      case "like":
        vals.push(val);
        return `${key} LIKE ?`;
      case "ilike":
        vals.push(val);
        return `LOWER(${key}) LIKE LOWER(?)`;
      case "and":
        return (val as { op: string; val: unknown }[])
          .map((v) => this._decideOperator(key, v.op, v.val, vals))
          .join(" AND ");
      case "of": {
        const v = val as {
          path: string[];
          value: unknown;
          cast?: "string" | "number" | "boolean" | null;
        };
        const path = this._buildJsonPath(key, v.path);
        const cast = v.cast
          ? `CAST(${path} AS ${
              v.cast === "number"
                ? "REAL"
                : v.cast === "boolean"
                ? "INTEGER"
                : "TEXT"
            })`
          : path;
        if (typeof v.value === "object" && v.value !== null) {
          const nested = v.value as { op: string; val: unknown };
          return this._decideOperator(cast, nested.op, nested.val, vals);
        }
        vals.push(v.value);
        return `${cast} = ?`;
      }
      case "oftype": {
        const v = val as { path: string[]; value: string };
        const mapped = this._mapJsonType(v.value);
        mapped.forEach((m) => vals.push(m));
        const placeholders = mapped.map(() => "?").join(",");
        return `json_type(${key}, '${this._jsonPointer(v.path)}') IN (${placeholders})`;
      }
      default:
        throw new Error("ERROR, operator not implemented: " + op);
    }
  }

  _mapJsonType(value: string): string[] {
    switch (value) {
      case "string":
        return ["text"];
      case "number":
        return ["integer", "real"];
      case "boolean":
        return ["true", "false"];
      case "null":
      case "array":
      case "object":
        return [value];
      default:
        throw new Error(`ERROR, unknown JSON type: ${value}`);
    }
  }

  _jsonPointer(path: string[]): string {
    if (path.length < 1) {
      throw new Error(
        "ERROR, JSON path requires at least one path element. You submitted []."
      );
    }
    path.forEach((p) => {
      if (p.includes("'") || p.includes('"')) {
        throw new Error(`JSON path segments must not contain quotes: ${p}`);
      }
    });
    return "$." + path.join(".");
  }

  _buildJsonPath(key: string, path: string[]): string {
    return `json_extract(${key}, '${this._jsonPointer(path)}')`;
  }

  async toArray<T>(): Promise<T[]> {
    const query = "SELECT * " + this._fromQuery;
    try {
      const stmt = this._db.prepare(query);
      return stmt.all(...((this._params ?? []) as never[])) as T[];
    } catch (e) {
      this._log("Error in toArray:", query, { params: this._params }, e);
      throw e;
    }
  }

  async count(): Promise<number> {
    const query = "SELECT COUNT(*) as count " + this._fromQuery;
    try {
      const stmt = this._db.prepare(query);
      const row = stmt.get(...((this._params ?? []) as never[])) as {
        count: number;
      };
      return row.count;
    } catch (e) {
      this._log("Error in count:", query, { params: this._params }, e);
      throw e;
    }
  }

  _transformValue(v: unknown): unknown {
    if (Array.isArray(v)) {
      return JSON.stringify(v);
    }
    if (typeof v === "boolean") {
      return v ? 1 : 0;
    }
    return v;
  }

  async insert<Rs extends string[]>(
    content: Record<string, unknown>[],
    returning: Rs | string[] = ["id"]
  ): Promise<Record<string, Id>[]> {
    if (content.length === 0) return [];
    checkKey(this._table);
    const keys = Object.keys(content[0]);
    keys.forEach(checkKey);
    const returnCols = (returning ?? []) as string[];
    returnCols.forEach(checkKey);

    let q = `INSERT INTO "${this._table}" `;
    q += "(" + keys.map((k) => `"${k}"`).join(",") + ") VALUES ";
    q += content.map(() => "(" + keys.map(() => "?").join(",") + ")").join(",");
    if (returnCols.length > 0) {
      q += " RETURNING " + returnCols.map((r) => `"${r}"`).join(",");
    }

    const params = ([] as unknown[]).concat(
      ...content.map((c) => keys.map((k) => this._transformValue(c[k])))
    );

    try {
      const stmt = this._db.prepare(q);
      if (returnCols.length === 0) {
        stmt.run(...(params as never[]));
        return [];
      }
      const rows = stmt.all(...(params as never[])) as Record<string, Id>[];
      return rows;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code && SQLITE_UNIQUE_CODES.has(code)) {
        return Promise.reject({
          msg: "ERROR, tried to insert, not unique",
          _code: 1,
        });
      }
      if (code && SQLITE_FK_CODES.has(code)) {
        return Promise.reject({
          msg: "ERROR, tried to insert, constraints not met",
          _code: 3,
        });
      }
      this._log("Error in insert:", q, params, err);
      throw err;
    }
  }

  async updateOne<T>(
    filter: Params,
    c: { [p: string]: unknown }
  ): Promise<Result<T>> {
    return this.update<T>(filter, c);
  }

  async update<T>(
    filter: Params,
    c: { [p: string]: unknown }
  ): Promise<Result<T>> {
    checkKey(this._table);
    const keys = Object.keys(c);
    keys.forEach(checkKey);
    if (keys.length === 0) {
      return { rows: [] as T[], rowCount: 0 };
    }

    const vals: unknown[] = keys.map((k) => this._transformValue(c[k]));
    let q = `UPDATE "${this._table}" SET `;
    q += keys.map((k) => `"${k}" = ?`).join(", ");
    q += " " + this._buildWhere(filter, vals);

    try {
      const stmt = this._db.prepare(q);
      const info = stmt.run(...(vals as never[]));
      return { rows: [] as T[], rowCount: info.changes };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code && SQLITE_UNIQUE_CODES.has(code)) {
        return Promise.reject({
          msg: "ERROR, tried to update, not unique",
          _code: 1,
        });
      }
      this._log("Error in update:", q, vals, err);
      throw err;
    }
  }

  async remove<T>(params: Params): Promise<Result<T>> {
    checkKey(this._table);
    const vals: unknown[] = [];
    let q = `DELETE FROM "${this._table}" `;
    q += this._buildWhere(params, vals);
    try {
      const stmt = this._db.prepare(q);
      const info = stmt.run(...(vals as never[]));
      return { rows: [] as T[], rowCount: info.changes };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
        return Promise.reject({
          msg: "ERROR, tried to remove item that is still a reference",
          _code: 2,
        });
      }
      this._log("Error in remove:", q, vals, err);
      throw err;
    }
  }

  async drop(): Promise<void> {
    checkKey(this._table);
    const q = `DROP TABLE "${this._table}"`;
    try {
      this._db.prepare(q).run();
    } catch (e) {
      this._log("Error in drop:", q, {}, e);
      throw e;
    }
  }
}

export default Query;
