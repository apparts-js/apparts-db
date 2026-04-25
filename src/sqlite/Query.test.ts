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

  beforeAll(async () => {
    dbPath = makeDbPath("crud");
    dbs = await connectSqlite({ filename: dbPath });
    await dbs.raw(
      "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, meta TEXT)"
    );
  });

  afterAll(async () => {
    await dbs.shutdown();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  test("insert returns primary keys of inserted rows", async () => {
    const ids = await dbs.collection("items").insert([
      { id: 1, name: "alice", age: 30 },
      { id: 2, name: "bob", age: 40 },
    ]);
    expect(ids.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  test("findById returns a single matching row", async () => {
    const rows = await dbs
      .collection("items")
      .findById({ id: 1 })
      .toArray<{ id: number; name: string; age: number }>();
    expect(rows).toEqual([{ id: 1, name: "alice", age: 30, meta: null }]);
  });

  test("findByIds returns rows for all provided ids", async () => {
    const rows = await dbs
      .collection("items")
      .findByIds({ id: [1, 2] })
      .toArray<{ id: number; name: string }>();
    expect(rows.map((r) => r.id).sort()).toEqual([1, 2]);
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

  test("find with limit and offset and order", async () => {
    const rows = await dbs
      .collection("items")
      .find({}, 1, 1, [{ key: "id", dir: "ASC" }])
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id)).toEqual([2]);
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

  test("remove deletes matching rows", async () => {
    await dbs.collection("items").remove({ id: 2 });
    const rows = await dbs.collection("items").findById({ id: 2 }).toArray();
    expect(rows).toEqual([]);
  });

  test("drop drops the table", async () => {
    await dbs.raw("CREATE TABLE drop_me (id INTEGER PRIMARY KEY, name TEXT)");
    await dbs.collection("drop_me").drop();
    await expect(dbs.raw("SELECT * FROM drop_me")).rejects.toBeDefined();
  });
});

runOrSkip("SQLite Query JSON operators", () => {
  let dbs: DBS;
  let dbPath: string;

  beforeAll(async () => {
    dbPath = makeDbPath("json");
    dbs = await connectSqlite({ filename: dbPath });
    await dbs.raw("CREATE TABLE docs (id INTEGER PRIMARY KEY, meta TEXT)");
    await dbs.collection("docs").insert([
      { id: 1, meta: JSON.stringify({ kind: "a", n: 1 }) },
      { id: 2, meta: JSON.stringify({ kind: "b", n: 2 }) },
      { id: 3, meta: JSON.stringify({ kind: "c", n: "3" }) },
    ]);
  });

  afterAll(async () => {
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

  test("oftype matches values by JSON type", async () => {
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
});

runOrSkip("SQLite Query constraint errors", () => {
  let dbs: DBS;
  let dbPath: string;

  beforeAll(async () => {
    dbPath = makeDbPath("err");
    dbs = await connectSqlite({ filename: dbPath });
    await dbs.raw(
      "CREATE TABLE uq (id INTEGER PRIMARY KEY, email TEXT UNIQUE)"
    );
  });

  afterAll(async () => {
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
    await expect(
      dbs.collection("uq").update({ id: 2 }, { email: "a@x" })
    ).rejects.toEqual({
      msg: "ERROR, tried to update, not unique",
      _code: 1,
    });
  });
});
