import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { connectSqlite } from "./index";
import DBS from "./DBS";

const shouldRun = process.env.DB_ENGINE === "sqlite";
const runOrSkip = shouldRun ? describe : describe.skip;

const makeDbPath = (slug: string) =>
  path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), `apparts-db-sqlite-${slug}-`)),
    "test.sqlite"
  );

runOrSkip("SQLite Query CRUD", () => {
  let dbs: DBS;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = makeDbPath("crud");
    dbs = await connectSqlite({ filename: dbPath });
    await dbs.raw(
      "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, meta TEXT)"
    );
    await dbs.collection("items").insert([
      { id: 1, name: "alice", age: 30 },
      { id: 2, name: "bob", age: 40 },
    ]);
  });

  afterEach(async () => {
    await dbs.shutdown();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  test("insert returns primary keys of inserted rows", async () => {
    const ids = await dbs
      .collection("items")
      .insert([{ id: 3, name: "carol", age: 50 }]);
    expect(ids.map((r) => r.id).sort()).toEqual([3]);
  });

  test("insert with empty content returns [] without running a statement", async () => {
    const ids = await dbs.collection("items").insert([]);
    expect(ids).toEqual([]);
  });

  test("insert with empty returning array runs INSERT without RETURNING", async () => {
    const result = await dbs
      .collection("items")
      .insert([{ id: 99, name: "nop", age: 1 }], []);
    expect(result).toEqual([]);
    const rows = await dbs
      .collection("items")
      .findById({ id: 99 })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id)).toEqual([99]);
  });

  test("findById returns a single matching row", async () => {
    const rows = await dbs.collection("items").findById({ id: 1 }).toArray<{
      id: number;
      name: string;
      age: number;
      meta: string | null;
    }>();
    expect(rows).toEqual([{ id: 1, name: "alice", age: 30, meta: null }]);
    // Pin the exact column shape so an unexpected extra column would be caught.
    expect(Object.keys(rows[0]).sort()).toEqual(["age", "id", "meta", "name"]);
  });

  test("findByIds returns rows for all provided ids (array branch)", async () => {
    const rows = await dbs
      .collection("items")
      .findByIds({ id: [1, 2] })
      .toArray<{ id: number; name: string }>();
    expect(rows.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  test("findByIds scalar branch falls through to equality", async () => {
    const rows = await dbs
      .collection("items")
      .findByIds({ id: 1 })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id)).toEqual([1]);
  });

  test("find with equality filter matches rows", async () => {
    const rows = await dbs
      .collection("items")
      .find({ name: "alice" })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id)).toEqual([1]);
  });

  test("find with null matches IS NULL", async () => {
    const rows = await dbs
      .collection("items")
      .find({ meta: null })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  test("find with in operator", async () => {
    const rows = await dbs
      .collection("items")
      .find({ id: { op: "in", val: [1, 2] } })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  test("find with in operator and empty array returns nothing", async () => {
    const rows = await dbs
      .collection("items")
      .find({ id: { op: "in", val: [] } })
      .toArray();
    expect(rows).toEqual([]);
  });

  test("find with notin operator", async () => {
    const rows = await dbs
      .collection("items")
      .find({ id: { op: "notin", val: [1] } })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id)).toEqual([2]);
  });

  test("find with notin operator and empty array returns all rows", async () => {
    const rows = await dbs
      .collection("items")
      .find({ id: { op: "notin", val: [] } })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  test("find with lt/lte/gt/gte operators", async () => {
    const lt = await dbs
      .collection("items")
      .find({ age: { op: "lt", val: 35 } })
      .toArray<{ id: number }>();
    expect(lt.map((r) => r.id)).toEqual([1]);

    const lte = await dbs
      .collection("items")
      .find({ age: { op: "lte", val: 30 } })
      .toArray<{ id: number }>();
    expect(lte.map((r) => r.id)).toEqual([1]);

    const gt = await dbs
      .collection("items")
      .find({ age: { op: "gt", val: 35 } })
      .toArray<{ id: number }>();
    expect(gt.map((r) => r.id)).toEqual([2]);

    const gte = await dbs
      .collection("items")
      .find({ age: { op: "gte", val: 40 } })
      .toArray<{ id: number }>();
    expect(gte.map((r) => r.id)).toEqual([2]);
  });

  test("find with like operator is case-sensitive", async () => {
    const lower = await dbs
      .collection("items")
      .find({ name: { op: "like", val: "ali%" } })
      .toArray<{ id: number }>();
    expect(lower.map((r) => r.id)).toEqual([1]);

    const upper = await dbs
      .collection("items")
      .find({ name: { op: "like", val: "ALI%" } })
      .toArray<{ id: number }>();
    expect(upper).toEqual([]);
  });

  test("find with ilike operator is case-insensitive", async () => {
    const rows = await dbs
      .collection("items")
      .find({ name: { op: "ilike", val: "ALI%" } })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id)).toEqual([1]);
  });

  test("find with ilike returns empty when no row matches", async () => {
    const rows = await dbs
      .collection("items")
      .find({ name: { op: "ilike", val: "ZZZ%" } })
      .toArray<{ id: number }>();
    expect(rows).toEqual([]);
  });

  test("find with exists true matches non-null values", async () => {
    const rows = await dbs
      .collection("items")
      .find({ name: { op: "exists", val: true } })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  test("find with exists false matches null values", async () => {
    const rows = await dbs
      .collection("items")
      .find({ meta: { op: "exists", val: false } })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  test("find with and composes conditions on one key", async () => {
    const rows = await dbs
      .collection("items")
      .find({
        age: {
          op: "and",
          val: [
            { op: "gte", val: 30 },
            { op: "lt", val: 40 },
          ],
        },
      })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id)).toEqual([1]);
  });

  test("find with and returns empty when the range excludes every row", async () => {
    const rows = await dbs
      .collection("items")
      .find({
        age: {
          op: "and",
          val: [
            { op: "gte", val: 100 },
            { op: "lt", val: 200 },
          ],
        },
      })
      .toArray<{ id: number }>();
    expect(rows).toEqual([]);
  });

  test("find with limit and offset and order", async () => {
    const rows = await dbs
      .collection("items")
      .find({}, 1, 1, [{ key: "id", dir: "ASC" }])
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id)).toEqual([2]);
  });

  test("find order by JSON path", async () => {
    await dbs.raw("CREATE TABLE ord (id INTEGER PRIMARY KEY, payload TEXT)");
    await dbs.collection("ord").insert([
      { id: 1, payload: JSON.stringify({ rank: 20 }) },
      { id: 2, payload: JSON.stringify({ rank: 10 }) },
      { id: 3, payload: JSON.stringify({ rank: 30 }) },
    ]);
    const rows = await dbs
      .collection("ord")
      .find({}, undefined, undefined, [
        { key: "payload", path: ["rank"], dir: "ASC" },
      ])
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id)).toEqual([2, 1, 3]);
  });

  test("count returns the number of matching rows", async () => {
    const c = await dbs.collection("items").find({}).count();
    expect(c).toBe(2);
  });

  test("update mutates matching rows", async () => {
    await dbs.collection("items").update({ id: 1 }, { age: 31 });
    const rows = await dbs
      .collection("items")
      .findById({ id: 1 })
      .toArray<{ age: number }>();
    expect(rows[0].age).toBe(31);
  });

  test("updateOne mutates matching rows", async () => {
    await dbs.collection("items").updateOne({ id: 2 }, { age: 41 });
    const rows = await dbs
      .collection("items")
      .findById({ id: 2 })
      .toArray<{ age: number }>();
    expect(rows[0].age).toBe(41);
  });

  test("update with empty update object short-circuits to rowCount 0", async () => {
    const res = await dbs.collection("items").update({ id: 1 }, {});
    expect(res).toEqual({ rows: [], rowCount: 0 });
  });

  test("update reports rowCount 0 when no row matches", async () => {
    const res = await dbs
      .collection("items")
      .update({ id: 9999 }, { age: 123 });
    expect(res.rowCount).toBe(0);
  });

  test("remove deletes matching rows", async () => {
    await dbs.collection("items").remove({ id: 2 });
    const rows = await dbs.collection("items").findById({ id: 2 }).toArray();
    expect(rows).toEqual([]);
  });

  test("remove with empty filter deletes every row", async () => {
    const res = await dbs.collection("items").remove({});
    expect(res.rowCount).toBe(2);
    const rows = await dbs.collection("items").find({}).toArray();
    expect(rows).toEqual([]);
  });

  test("drop drops the table and subsequent access reports no such table", async () => {
    await dbs.raw("CREATE TABLE drop_me (id INTEGER PRIMARY KEY, name TEXT)");
    await dbs.collection("drop_me").drop();
    await expect(dbs.raw("SELECT * FROM drop_me")).rejects.toMatchObject({
      code: "SQLITE_ERROR",
      message: expect.stringContaining("no such table"),
    });
  });

  test("_transformValue coerces booleans to 0/1 on insert", async () => {
    await dbs.raw("CREATE TABLE flags (id INTEGER PRIMARY KEY, flag INTEGER)");
    await dbs.collection("flags").insert([
      { id: 1, flag: true },
      { id: 2, flag: false },
    ]);
    const rows = await dbs
      .collection("flags")
      .find({})
      .toArray<{ id: number; flag: number }>();
    expect(rows.sort((a, b) => a.id - b.id)).toEqual([
      { id: 1, flag: 1 },
      { id: 2, flag: 0 },
    ]);
  });

  test("_transformValue stores arrays as JSON on insert", async () => {
    await dbs.raw("CREATE TABLE lists (id INTEGER PRIMARY KEY, tags TEXT)");
    await dbs.collection("lists").insert([{ id: 1, tags: ["a", "b", "c"] }]);
    const rows = await dbs
      .collection("lists")
      .find({})
      .toArray<{ id: number; tags: string }>();
    expect(rows[0].tags).toBe('["a","b","c"]');
  });
});

runOrSkip("SQLite Query JSON operators", () => {
  let dbs: DBS;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = makeDbPath("json");
    dbs = await connectSqlite({ filename: dbPath });
    await dbs.raw("CREATE TABLE docs (id INTEGER PRIMARY KEY, meta TEXT)");
    await dbs.collection("docs").insert([
      { id: 1, meta: JSON.stringify({ kind: "a", n: 1, active: true }) },
      { id: 2, meta: JSON.stringify({ kind: "b", n: 2.5, active: false }) },
      { id: 3, meta: JSON.stringify({ kind: "c", n: "3" }) },
      { id: 4, meta: JSON.stringify({ kind: "d", n: null, items: [1, 2] }) },
      {
        id: 5,
        meta: JSON.stringify({ kind: "e", nested: { a: 1 } }),
      },
    ]);
  });

  afterEach(async () => {
    await dbs.shutdown();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  test("of matches a nested JSON path equality", async () => {
    const rows = await dbs
      .collection("docs")
      .find({
        meta: { op: "of", val: { path: ["kind"], value: "a" } },
      })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id)).toEqual([1]);
  });

  test("of with a nested operator filters on JSON path", async () => {
    const rows = await dbs
      .collection("docs")
      .find({
        meta: {
          op: "of",
          val: {
            path: ["n"],
            value: { op: "gte", val: 2 },
            cast: "number",
          },
        },
      })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id).sort()).toEqual([2, 3]);
  });

  test("of with primitive value applies cast to the comparison", async () => {
    const rows = await dbs
      .collection("docs")
      .find({
        meta: {
          op: "of",
          val: { path: ["n"], value: 1, cast: "number" },
        },
      })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id)).toEqual([1]);
  });

  test("oftype string matches text values", async () => {
    const rows = await dbs
      .collection("docs")
      .find({
        meta: {
          op: "oftype",
          val: { path: ["n"], value: "string" },
        },
      })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id)).toEqual([3]);
  });

  test("oftype number matches both integer and real values", async () => {
    const rows = await dbs
      .collection("docs")
      .find({
        meta: {
          op: "oftype",
          val: { path: ["n"], value: "number" },
        },
      })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  test("oftype boolean matches true/false JSON values", async () => {
    const rows = await dbs
      .collection("docs")
      .find({
        meta: {
          op: "oftype",
          val: { path: ["active"], value: "boolean" },
        },
      })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  test("oftype null matches JSON null values", async () => {
    const rows = await dbs
      .collection("docs")
      .find({
        meta: {
          op: "oftype",
          val: { path: ["n"], value: "null" },
        },
      })
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id)).toEqual([4]);
  });

  test("oftype array matches JSON arrays and is empty for scalar paths", async () => {
    const match = await dbs
      .collection("docs")
      .find({
        meta: {
          op: "oftype",
          val: { path: ["items"], value: "array" },
        },
      })
      .toArray<{ id: number }>();
    expect(match.map((r) => r.id)).toEqual([4]);

    const none = await dbs
      .collection("docs")
      .find({
        meta: {
          op: "oftype",
          val: { path: ["kind"], value: "array" },
        },
      })
      .toArray<{ id: number }>();
    expect(none).toEqual([]);
  });

  test("oftype object matches JSON objects and is empty for scalar paths", async () => {
    const match = await dbs
      .collection("docs")
      .find({
        meta: {
          op: "oftype",
          val: { path: ["nested"], value: "object" },
        },
      })
      .toArray<{ id: number }>();
    expect(match.map((r) => r.id)).toEqual([5]);

    const none = await dbs
      .collection("docs")
      .find({
        meta: {
          op: "oftype",
          val: { path: ["kind"], value: "object" },
        },
      })
      .toArray<{ id: number }>();
    expect(none).toEqual([]);
  });
});

runOrSkip("SQLite Query constraint errors", () => {
  let dbs: DBS;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = makeDbPath("err");
    dbs = await connectSqlite({ filename: dbPath });
    await dbs.raw(
      "CREATE TABLE uq (id INTEGER PRIMARY KEY, email TEXT UNIQUE)"
    );
    await dbs.raw(
      "CREATE TABLE parents (id INTEGER PRIMARY KEY, label TEXT NOT NULL)"
    );
    await dbs.raw(
      `CREATE TABLE children (
         id INTEGER PRIMARY KEY,
         parent_id INTEGER NOT NULL,
         note TEXT CHECK (length(note) <= 5),
         FOREIGN KEY (parent_id) REFERENCES parents(id)
       )`
    );
  });

  afterEach(async () => {
    await dbs.shutdown();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  test("duplicate primary key insert rejects with _code 1", async () => {
    await dbs.collection("uq").insert([{ id: 1, email: "a@x" }]);
    await expect(
      dbs.collection("uq").insert([{ id: 1, email: "b@x" }])
    ).rejects.toEqual({
      msg: "ERROR, tried to insert, not unique",
      _code: 1,
    });
  });

  test("duplicate unique column update rejects with _code 1", async () => {
    await dbs.collection("uq").insert([{ id: 2, email: "c@x" }]);
    await dbs.collection("uq").insert([{ id: 3, email: "a@x" }]);
    await expect(
      dbs.collection("uq").update({ id: 2 }, { email: "a@x" })
    ).rejects.toEqual({
      msg: "ERROR, tried to update, not unique",
      _code: 1,
    });
  });

  test("insert rejecting FK constraint maps to _code 3", async () => {
    await expect(
      dbs.collection("children").insert([{ id: 1, parent_id: 999 }])
    ).rejects.toEqual({
      msg: "ERROR, tried to insert, constraints not met",
      _code: 3,
    });
  });

  test("insert rejecting NOT NULL maps to _code 3", async () => {
    await expect(dbs.collection("parents").insert([{ id: 1 }])).rejects.toEqual(
      {
        msg: "ERROR, tried to insert, constraints not met",
        _code: 3,
      }
    );
  });

  test("insert rejecting CHECK maps to _code 3", async () => {
    await dbs.collection("parents").insert([{ id: 1, label: "ok" }]);
    await expect(
      dbs
        .collection("children")
        .insert([{ id: 1, parent_id: 1, note: "too long" }])
    ).rejects.toEqual({
      msg: "ERROR, tried to insert, constraints not met",
      _code: 3,
    });
  });

  test("remove rejecting FK constraint maps to _code 2", async () => {
    await dbs.collection("parents").insert([{ id: 1, label: "ok" }]);
    await dbs.collection("children").insert([{ id: 1, parent_id: 1 }]);
    await expect(dbs.collection("parents").remove({ id: 1 })).rejects.toEqual({
      msg: "ERROR, tried to remove item that is still a reference",
      _code: 2,
    });
  });
});

runOrSkip("SQLite Query guards and helpers", () => {
  let dbs: DBS;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = makeDbPath("guards");
    dbs = await connectSqlite({ filename: dbPath });
    await dbs.raw("CREATE TABLE g (id INTEGER PRIMARY KEY, name TEXT)");
    await dbs.collection("g").insert([{ id: 1, name: "x" }]);
  });

  afterEach(async () => {
    await dbs.shutdown();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  test("_decideOperator throws for unknown operators", () => {
    expect(() =>
      dbs.collection("g").find({
        id: {
          op: "unknown" as unknown as "in",
          val: 1 as unknown as number[],
        },
      })
    ).toThrow(/operator not implemented: unknown/);
  });

  test("_buildWhere throws for non-operator value objects", () => {
    expect(() =>
      dbs.collection("g").find({
        id: { $gt: 1 } as unknown as {
          op: "gt";
          val: number;
        },
      })
    ).toThrow(/unknown value type for key "id"/);
  });

  test("checkKey rejects table names containing double quotes", () => {
    expect(() => dbs.collection('bad"name').find({})).toThrow(
      'Key must not contain "!'
    );
  });

  test("checkKey rejects filter keys containing double quotes", () => {
    expect(() => dbs.collection("g").find({ 'bad"col': 1 })).toThrow(
      'Key must not contain "!'
    );
  });

  test("checkKey rejects insert column names containing double quotes", async () => {
    await expect(
      dbs.collection("g").insert([{ 'bad"col': 1 } as Record<string, unknown>])
    ).rejects.toBe('Key must not contain "!');
  });

  test("checkKey rejects returning keys containing double quotes", async () => {
    await expect(
      dbs.collection("g").insert([{ id: 2, name: "y" }], ['bad"col'])
    ).rejects.toBe('Key must not contain "!');
  });

  test("checkKey rejects order-by keys containing double quotes", () => {
    expect(() =>
      dbs
        .collection("g")
        .find({}, undefined, undefined, [{ key: 'bad"col', dir: "ASC" }])
    ).toThrow('Key must not contain "!');
  });

  test("_mapJsonType throws for unknown JSON types", () => {
    expect(() =>
      dbs.collection("g").find({
        name: {
          op: "oftype" as unknown as "in",
          val: {
            path: ["x"],
            value: "float",
          } as unknown as number[],
        },
      })
    ).toThrow(/unknown JSON type: float/);
  });

  test("_jsonPointer rejects empty path arrays", () => {
    expect(() =>
      dbs.collection("g").find({
        name: {
          op: "oftype" as unknown as "in",
          val: {
            path: [] as string[],
            value: "string",
          } as unknown as number[],
        },
      })
    ).toThrow(/at least one path element/);
  });

  test("_jsonPointer rejects segments containing quotes", () => {
    expect(() =>
      dbs.collection("g").find({
        name: {
          op: "oftype" as unknown as "in",
          val: {
            path: ["kin'd"],
            value: "string",
          } as unknown as number[],
        },
      })
    ).toThrow(/must not contain quotes/);
  });
});
