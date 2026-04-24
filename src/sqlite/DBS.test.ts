import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import Database from "better-sqlite3";

import { connectSqlite } from "./index";
import DBS from "./DBS";
import Query from "./Query";

const shouldRun = process.env.DB_ENGINE === "sqlite";
const runOrSkip = shouldRun ? describe : describe.skip;

const makeDbPath = () =>
  path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "apparts-db-sqlite-dbs-")),
    "dbs.sqlite"
  );

runOrSkip("SQLite DBS", () => {
  let dbs: DBS;
  let dbPath: string;

  beforeAll(async () => {
    dbPath = makeDbPath();
    dbs = await connectSqlite({ filename: dbPath });
    await dbs.raw("CREATE TABLE dbs_items (id INTEGER PRIMARY KEY, name TEXT)");
  });

  afterAll(async () => {
    await dbs.shutdown();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  test("raw executes parameterised reads", async () => {
    await dbs.raw("INSERT INTO dbs_items (id, name) VALUES (?, ?)", [
      1,
      "alpha",
    ]);
    const res = await dbs.raw<{ id: number; name: string }>(
      "SELECT * FROM dbs_items WHERE id = ?",
      [1]
    );
    expect(res.rows).toEqual([{ id: 1, name: "alpha" }]);
    expect(res.rowCount).toBe(1);
  });

  test("raw reports rowCount on writes", async () => {
    const res = await dbs.raw("DELETE FROM dbs_items WHERE id = ?", [1]);
    expect(res.rowCount).toBe(1);
    expect(res.rows).toEqual([]);
  });

  test("collection returns a Query bound to the table", () => {
    const q = dbs.collection("dbs_items");
    expect(q).toBeDefined();
  });
});

runOrSkip("SQLite DBS log-on-error behaviour", () => {
  let dbs: DBS;
  let dbPath: string;
  let logMock: jest.SpyInstance;

  beforeEach(async () => {
    dbPath = makeDbPath();
    dbs = await connectSqlite({
      filename: dbPath,
      logs: "errors",
      logParams: true,
    });
    await dbs.raw("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)");
    logMock = jest.spyOn(console, "log").mockImplementation(() => {
      // silenced
    });
  });

  afterEach(async () => {
    logMock.mockRestore();
    await dbs.shutdown();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  const makeFailingDbs = (): DBS => {
    const err = Object.assign(new Error("boom"), { code: "SQLITE_BOOM" });
    const stmt = {
      run: () => {
        throw err;
      },
      all: () => {
        throw err;
      },
      get: () => {
        throw err;
      },
      reader: true,
    };
    const fakeDb = { prepare: () => stmt } as unknown as Database.Database;
    return new DBS(fakeDb, {
      filename: dbPath,
      logs: "errors",
      logParams: true,
    });
  };

  test("raw logs the query and params on error", async () => {
    const bad = makeFailingDbs();
    await expect(bad.raw("SELECT 1", [1])).rejects.toThrow("boom");
    expect(logMock.mock.calls).toEqual([
      [
        "Error in dbs.raw",
        "\nQUERY:\n",
        "SELECT 1",
        "\nPARAMS:\n",
        { params: [1] },
        "\nERROR:\n",
        expect.any(Error),
      ],
    ]);
  });

  test("insert logs the query and params on error", async () => {
    const q = makeFailingDbs().collection("t") as Query;
    await expect(q.insert([{ name: "a" }])).rejects.toThrow("boom");
    expect(logMock.mock.calls).toEqual([
      [
        "Error in insert:",
        "\nQUERY:\n",
        'INSERT INTO "t" ("name") VALUES (?) RETURNING "id"',
        "\nPARAMS:\n",
        ["a"],
        "\nERROR:\n",
        expect.any(Error),
      ],
    ]);
  });

  test("update logs the query and params on error", async () => {
    const q = makeFailingDbs().collection("t") as Query;
    await expect(q.update({ id: 1 }, { name: "b" })).rejects.toThrow("boom");
    expect(logMock.mock.calls).toEqual([
      [
        "Error in update:",
        "\nQUERY:\n",
        'UPDATE "t" SET "name" = ? WHERE "id" = ?',
        "\nPARAMS:\n",
        ["b", 1],
        "\nERROR:\n",
        expect.any(Error),
      ],
    ]);
  });

  test("updateOne logs the query and params on error", async () => {
    const q = makeFailingDbs().collection("t") as Query;
    await expect(q.updateOne({ id: 1 }, { name: "b" })).rejects.toThrow("boom");
    expect(logMock.mock.calls[0][0]).toBe("Error in update:");
  });

  test("remove logs the query and params on error", async () => {
    const q = makeFailingDbs().collection("t") as Query;
    await expect(q.remove({ id: 1 })).rejects.toThrow("boom");
    expect(logMock.mock.calls).toEqual([
      [
        "Error in remove:",
        "\nQUERY:\n",
        'DELETE FROM "t" WHERE "id" = ?',
        "\nPARAMS:\n",
        [1],
        "\nERROR:\n",
        expect.any(Error),
      ],
    ]);
  });

  test("drop logs the query on error", async () => {
    const q = makeFailingDbs().collection("t") as Query;
    await expect(q.drop()).rejects.toThrow("boom");
    expect(logMock.mock.calls).toEqual([
      [
        "Error in drop:",
        "\nQUERY:\n",
        'DROP TABLE "t"',
        "\nPARAMS:\n",
        {},
        "\nERROR:\n",
        expect.any(Error),
      ],
    ]);
  });

  test("toArray logs the query and params on error", async () => {
    const q = makeFailingDbs().collection("t") as Query;
    await expect(q.find({ id: 1 }).toArray()).rejects.toThrow("boom");
    expect(logMock.mock.calls).toEqual([
      [
        "Error in toArray:",
        "\nQUERY:\n",
        'SELECT * FROM "t" WHERE "id" = ?',
        "\nPARAMS:\n",
        { params: [1] },
        "\nERROR:\n",
        expect.any(Error),
      ],
    ]);
  });

  test("count logs the query and params on error", async () => {
    const q = makeFailingDbs().collection("t") as Query;
    await expect(q.find({ id: 1 }).count()).rejects.toThrow("boom");
    expect(logMock.mock.calls).toEqual([
      [
        "Error in count:",
        "\nQUERY:\n",
        'SELECT COUNT(*) as count FROM "t" WHERE "id" = ?',
        "\nPARAMS:\n",
        { params: [1] },
        "\nERROR:\n",
        expect.any(Error),
      ],
    ]);
  });
});
