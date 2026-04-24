import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { connectSqlite } from "./index";

const shouldRun = process.env.DB_ENGINE === "sqlite";
const runOrSkip = shouldRun ? describe : describe.skip;

runOrSkip("SQLite connectivity", () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "apparts-db-sqlite-")),
      "connectivity.sqlite"
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  test("opens a file-backed database and executes a trivial query", async () => {
    const dbs = await connectSqlite({ filename: dbPath });
    try {
      const result = await dbs.raw<{ one: number }>("SELECT 1 AS one");
      expect(result.rows[0].one).toBe(1);
    } finally {
      await dbs.shutdown();
    }
  });

  test("case_sensitive_like pragma is enabled", async () => {
    const dbs = await connectSqlite({ filename: dbPath });
    try {
      const r = await dbs.raw<{ v: number }>(
        "SELECT CASE WHEN 'ALICE' LIKE 'ali%' THEN 1 ELSE 0 END AS v"
      );
      expect(r.rows[0].v).toBe(0);
    } finally {
      await dbs.shutdown();
    }
  });

  test("foreign_keys pragma is enabled", async () => {
    const dbs = await connectSqlite({ filename: dbPath });
    try {
      const r = await dbs.raw<{ foreign_keys: number }>("PRAGMA foreign_keys");
      expect(r.rows[0].foreign_keys).toBe(1);
    } finally {
      await dbs.shutdown();
    }
  });

  test("readonly config rejects writes", async () => {
    const rwDbs = await connectSqlite({ filename: dbPath });
    await rwDbs.raw(
      "CREATE TABLE IF NOT EXISTS ro_items (id INTEGER PRIMARY KEY)"
    );
    await rwDbs.shutdown();

    const roDbs = await connectSqlite({
      filename: dbPath,
      readonly: true,
    });
    try {
      await expect(
        roDbs.raw("INSERT INTO ro_items (id) VALUES (1)")
      ).rejects.toThrow(/readonly/i);
    } finally {
      await roDbs.shutdown();
    }
  });

  test("fileMustExist throws when the file is missing", async () => {
    const missing = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "apparts-db-sqlite-miss-")),
      "does-not-exist.sqlite"
    );
    await expect(
      connectSqlite({ filename: missing, fileMustExist: true })
    ).rejects.toThrow();
  });

  test("timeout config is accepted and passed through", async () => {
    const withTimeout = await connectSqlite({
      filename: dbPath,
      timeout: 1234,
    });
    try {
      const r = await withTimeout.raw<{ v: number }>("SELECT 1 AS v");
      expect(r.rows[0].v).toBe(1);
    } finally {
      await withTimeout.shutdown();
    }
  });
});
