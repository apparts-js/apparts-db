import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { connectSqlite } from "./index";
import DBS from "./DBS";

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
