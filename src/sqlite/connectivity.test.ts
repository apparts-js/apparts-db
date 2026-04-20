import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const shouldRun = process.env.DB_ENGINE === "sqlite";
const runOrSkip = shouldRun ? describe : describe.skip;

runOrSkip("SQLite connectivity", () => {
  let dbPath: string;

  beforeAll(() => {
    dbPath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "apparts-db-sqlite-")),
      "connectivity.sqlite"
    );
  });

  afterAll(() => {
    try {
      fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  test("opens a file-backed database and executes a trivial query", async () => {
    const { connectSqlite } = await import("./index");
    const dbs = await connectSqlite({ filename: dbPath });
    try {
      const result = await dbs.raw<{ one: number }>("SELECT 1 AS one");
      expect(result.rows[0].one).toBe(1);
    } finally {
      await dbs.shutdown();
    }
  });
});
