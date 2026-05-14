import { NotSupportedByDBEngine } from "../generic";
import { connectDynamo } from "./index";
import DBS from "./DBS";
import Transaction from "./Transaction";
import { ensureTable, dropTable, buildConfig } from "../tests/dynamodb";

const TEST_TABLE = "dynamo_test_tx";

describe("DynamoDB Transaction", () => {
  let dbs: DBS;

  beforeAll(async () => {
    await ensureTable(TEST_TABLE);
    dbs = await connectDynamo(buildConfig());
  }, 60000);
  afterAll(async () => {
    await dbs.shutdown();
    await dropTable(TEST_TABLE);
  }, 60000);

  describe("insert", () => {
    test("committed transaction persists writes", async () => {
      await dbs.transaction(async (t) => {
        await t.collection(TEST_TABLE).insert([{ id: "tx-1", number: 1 }]);
      });
      const rows = await dbs
        .collection(TEST_TABLE)
        .findById({ id: "tx-1" })
        .toArray<{ id: string; number: number }>();
      expect(rows).toEqual([{ id: "tx-1", number: 1 }]);
    });

    test("transaction insert of an existing primary key cancels the transaction", async () => {
      await dbs.collection(TEST_TABLE).insert([{ id: "tx-dup", number: 1 }]);
      await expect(
        dbs.transaction(async (t) => {
          await t.collection(TEST_TABLE).insert([{ id: "tx-dup", number: 99 }]);
        })
      ).rejects.toThrow();
      const rows = await dbs
        .collection(TEST_TABLE)
        .findById({ id: "tx-dup" })
        .toArray<{ id: string; number: number }>();
      expect(rows).toEqual([{ id: "tx-dup", number: 1 }]);
    });
  });

  describe("rollback", () => {
    test("rolled back transaction does not persist writes", async () => {
      await expect(
        dbs.transaction(async (t) => {
          await t.collection(TEST_TABLE).insert([{ id: "tx-2", number: 1 }]);
          throw new Error("rollback!");
        })
      ).rejects.toThrow("rollback!");
      const rows = await dbs
        .collection(TEST_TABLE)
        .findById({ id: "tx-2" })
        .toArray();
      expect(rows).toEqual([]);
    });

    test("transaction rollback undoes update and remove staged in the same tx", async () => {
      await dbs
        .collection(TEST_TABLE)
        .insert([{ id: "tx-roll-upd", number: 1 }]);
      await dbs
        .collection(TEST_TABLE)
        .insert([{ id: "tx-roll-rm", number: 1 }]);
      await expect(
        dbs.transaction(async (t) => {
          await t
            .collection(TEST_TABLE)
            .update({ id: "tx-roll-upd" }, { number: 2 });
          await t.collection(TEST_TABLE).remove({ id: "tx-roll-rm" });
          throw new Error("abort");
        })
      ).rejects.toThrow("abort");
      const rows = await dbs
        .collection(TEST_TABLE)
        .findByIds({ id: ["tx-roll-upd", "tx-roll-rm"] })
        .toArray<{ id: string; number: number }>();
      const byId = new Map(rows.map((r) => [r.id, r]));
      expect(byId.get("tx-roll-upd")).toEqual({ id: "tx-roll-upd", number: 1 });
      expect(byId.get("tx-roll-rm")).toEqual({ id: "tx-roll-rm", number: 1 });
    });

    test("rollback after a successful commit logs a warning and does not throw", async () => {
      await dbs
        .collection(TEST_TABLE)
        .insert([{ id: "post-commit", number: 1 }]);
      const tx = new Transaction(dbs._client, { config: dbs._config });
      await tx
        .collection(TEST_TABLE)
        .insert([{ id: "post-commit-2", number: 2 }]);
      await tx.commit();
      await expect(tx.rollback()).resolves.toBeUndefined();
      const [row] = await dbs
        .collection(TEST_TABLE)
        .findById({ id: "post-commit-2" })
        .toArray<{ id: string; number: number }>();
      expect(row).toEqual({ id: "post-commit-2", number: 2 });
    });
  });

  describe("update", () => {
    test("transaction update of an existing row persists on commit", async () => {
      await dbs.collection(TEST_TABLE).insert([{ id: "tx-upd", number: 1 }]);
      await dbs.transaction(async (t) => {
        await t.collection(TEST_TABLE).update({ id: "tx-upd" }, { number: 99 });
      });
      const [row] = await dbs
        .collection(TEST_TABLE)
        .findById({ id: "tx-upd" })
        .toArray<{ id: string; number: number }>();
      expect(row).toEqual({ id: "tx-upd", number: 99 });
    });

    test("transaction update of a non-existent row cancels the transaction", async () => {
      await expect(
        dbs.transaction(async (t) => {
          await t
            .collection(TEST_TABLE)
            .update({ id: "tx-missing" }, { number: 99 });
        })
      ).rejects.toThrow();
      const rows = await dbs
        .collection(TEST_TABLE)
        .findById({ id: "tx-missing" })
        .toArray();
      expect(rows).toEqual([]);
    });

    test("transaction update with a non-PK filter throws NotSupportedByDBEngine", async () => {
      await expect(
        dbs.transaction(async (t) => {
          await t.collection(TEST_TABLE).update({ number: 1 }, { tag: "x" });
        })
      ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
    });

    test("transaction updateOne delegates to update and persists on commit", async () => {
      await dbs
        .collection(TEST_TABLE)
        .insert([{ id: "tx-upd-one", number: 1 }]);
      await dbs.transaction(async (t) => {
        await t
          .collection(TEST_TABLE)
          .updateOne({ id: "tx-upd-one" }, { number: 77 });
      });
      const [row] = await dbs
        .collection(TEST_TABLE)
        .findById({ id: "tx-upd-one" })
        .toArray<{ id: string; number: number }>();
      expect(row).toEqual({ id: "tx-upd-one", number: 77 });
    });
  });

  describe("remove", () => {
    test("transaction remove of an existing row persists on commit", async () => {
      await dbs.collection(TEST_TABLE).insert([{ id: "tx-rm", number: 1 }]);
      await dbs.transaction(async (t) => {
        await t.collection(TEST_TABLE).remove({ id: "tx-rm" });
      });
      const rows = await dbs
        .collection(TEST_TABLE)
        .findById({ id: "tx-rm" })
        .toArray();
      expect(rows).toEqual([]);
    });

    test("transaction remove with a non-PK filter throws NotSupportedByDBEngine", async () => {
      await expect(
        dbs.transaction(async (t) => {
          await t.collection(TEST_TABLE).remove({ tag: "x" });
        })
      ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
    });
  });

  describe("raw", () => {
    test("raw forwards verified DynamoDB requests inside a transaction", async () => {
      await dbs.collection(TEST_TABLE).insert([{ id: "tx-raw", number: 1 }]);
      const res = await dbs.transaction(async (t) => {
        return t.raw("GetItem", [
          { TableName: TEST_TABLE, Key: { id: "tx-raw" } },
        ]);
      });
      expect(res.rowCount).toBe(1);
      expect((res.rows as { id: string; number: number }[])[0]).toEqual({
        id: "tx-raw",
        number: 1,
      });
    });

    test("raw with an unknown operation throws NotSupportedByDBEngine", async () => {
      await expect(
        dbs.transaction(async (t) => {
          await t.raw("SELECT 1");
        })
      ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
    });
  });

  describe("reads inside a transaction", () => {
    test("read operations inside a transaction throw NotSupportedByDBEngine", async () => {
      await expect(
        dbs.transaction(async (t) => {
          t.collection(TEST_TABLE).find({});
        })
      ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
      await expect(
        dbs.transaction(async (t) => {
          t.collection(TEST_TABLE).findById({ id: "x" });
        })
      ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
      await expect(
        dbs.transaction(async (t) => {
          await t.collection(TEST_TABLE).count();
        })
      ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
    });
  });

  describe("limits", () => {
    test("transaction commit with >100 ops throws NotSupportedByDBEngine, _writes not drained", async () => {
      const tx = new Transaction(dbs._client, { config: dbs._config });
      const q = tx.collection(TEST_TABLE);
      const items = Array.from({ length: 101 }, (_, i) => ({ id: `big-${i}` }));
      await q.insert(items);
      await expect(tx.commit()).rejects.toBeInstanceOf(NotSupportedByDBEngine);
      expect(tx._writes).toHaveLength(101);
      const sample = await dbs
        .collection(TEST_TABLE)
        .findByIds({ id: ["big-0", "big-50", "big-100"] })
        .toArray();
      expect(sample).toEqual([]);
    });
  });

  describe("nested transactions", () => {
    test("nested transactions are not supported", async () => {
      await expect(
        dbs.transaction(async (t) => {
          await (t as Transaction).transaction();
        })
      ).rejects.toThrow("Can not start new transaction in transaction");
    });
  });
});
