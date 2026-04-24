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

runOrSkip("SQLite Transaction", () => {
  let dbs: DBS;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = makeDbPath("tx");
    dbs = await connectSqlite({ filename: dbPath });
    await dbs.raw("CREATE TABLE tx_items (id INTEGER PRIMARY KEY, name TEXT)");
  });

  afterEach(async () => {
    await dbs.shutdown();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  test("commit persists all writes inside the transaction", async () => {
    await dbs.transaction(async (t) => {
      await t.collection("tx_items").insert([{ id: 1, name: "a" }]);
      await t.collection("tx_items").insert([{ id: 2, name: "b" }]);
    });
    const rows = await dbs
      .collection("tx_items")
      .find({})
      .toArray<{ id: number }>();
    expect(rows.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  test("rollback discards writes when callback throws", async () => {
    await expect(
      dbs.transaction(async (t) => {
        await t.collection("tx_items").insert([{ id: 1, name: "a" }]);
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    const rows = await dbs.collection("tx_items").find({}).toArray();
    expect(rows).toEqual([]);
  });

  test("nested transaction throws", async () => {
    await expect(
      dbs.transaction(async (t) => {
        await (
          t as unknown as { transaction: (fn: unknown) => Promise<unknown> }
        ).transaction(async () => undefined);
      })
    ).rejects.toThrow("Can not start new transaction in transaction");
  });

  test("transaction Query supports find/update/remove", async () => {
    await dbs.collection("tx_items").insert([
      { id: 1, name: "a" },
      { id: 2, name: "b" },
    ]);
    await dbs.transaction(async (t) => {
      await t.collection("tx_items").update({ id: 1 }, { name: "alpha" });
      await t.collection("tx_items").remove({ id: 2 });
    });
    const rows = await dbs
      .collection("tx_items")
      .find({})
      .toArray<{ id: number; name: string }>();
    expect(rows).toEqual([{ id: 1, name: "alpha" }]);
  });

  test("rollback after commit is a no-op", async () => {
    await dbs.transaction(async (t) => {
      await t.collection("tx_items").insert([{ id: 1, name: "a" }]);
      await t.commit();
      await t.rollback();
    });
    const rows = await dbs.collection("tx_items").find({}).toArray();
    expect(rows.length).toBe(1);
  });

  test("commit after rollback is a no-op", async () => {
    await expect(
      dbs.transaction(async (t) => {
        await t.collection("tx_items").insert([{ id: 1, name: "a" }]);
        await t.rollback();
        await t.commit();
        throw new Error("explicit early exit");
      })
    ).rejects.toThrow("explicit early exit");
    const rows = await dbs.collection("tx_items").find({}).toArray();
    expect(rows).toEqual([]);
  });

  test("raw inside a transaction executes parameterised reads", async () => {
    await dbs.collection("tx_items").insert([{ id: 1, name: "alpha" }]);
    await dbs.transaction(async (t) => {
      const res = await t.raw<{ id: number; name: string }>(
        "SELECT id, name FROM tx_items WHERE id = ?",
        [1]
      );
      expect(res.rows).toEqual([{ id: 1, name: "alpha" }]);
      expect(res.rowCount).toBe(1);
    });
  });

  test("raw inside a transaction executes writes and reports rowCount", async () => {
    await dbs.collection("tx_items").insert([{ id: 1, name: "a" }]);
    await dbs.transaction(async (t) => {
      const res = await t.raw("UPDATE tx_items SET name = ? WHERE id = ?", [
        "renamed",
        1,
      ]);
      expect(res.rows).toEqual([]);
      expect(res.rowCount).toBe(1);
    });
    const rows = await dbs
      .collection("tx_items")
      .find({})
      .toArray<{ id: number; name: string }>();
    expect(rows).toEqual([{ id: 1, name: "renamed" }]);
  });

  test("DBS.transaction always calls end()", async () => {
    const endCalls: string[] = [];
    await dbs.transaction(async (t) => {
      const originalEnd = t.end.bind(t);
      t.end = async () => {
        endCalls.push("commit-path");
        return originalEnd();
      };
      await t.collection("tx_items").insert([{ id: 1, name: "a" }]);
    });
    expect(endCalls).toEqual(["commit-path"]);

    await expect(
      dbs.transaction(async (t) => {
        const originalEnd = t.end.bind(t);
        t.end = async () => {
          endCalls.push("error-path");
          return originalEnd();
        };
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(endCalls).toEqual(["commit-path", "error-path"]);
  });
});
