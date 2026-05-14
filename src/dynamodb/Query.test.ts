import { Filter, NotSupportedByDBEngine, Params } from "../generic";
import { connectDynamo } from "./index";
import DBS from "./DBS";
import { dropTable, ensureTable, buildConfig } from "../tests/dynamodb";

const TEST_TABLE = "dynamo_test_items";

// Cast helper for operators like "notin" that are used by this codebase
// but absent from the generic `Filter` union.
const p = (v: unknown): Params => v as Params;

describe("DynamoDB Query CRUD", () => {
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
    test("insert returns the primary key of the inserted item", async () => {
      const aIds = await dbs
        .collection(TEST_TABLE)
        .insert([{ id: "a", number: 1 }]);
      const bIds = await dbs
        .collection(TEST_TABLE)
        .insert([{ id: "b", number: 2 }]);
      expect([...aIds, ...bIds].map((r) => r.id).sort()).toEqual(["a", "b"]);
    });

    test("insert of an empty array is a no-op", async () => {
      const ids = await dbs.collection(TEST_TABLE).insert([]);
      expect(ids).toEqual([]);
    });

    test("multi-row insert throws NotSupportedByDBEngine", async () => {
      await expect(
        dbs
          .collection(TEST_TABLE)
          .insert([{ id: "multi-1" }, { id: "multi-2" }])
      ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
    });

    test("insert rejects duplicate primary keys with _code: 1", async () => {
      await dbs.collection(TEST_TABLE).insert([{ id: "dup", number: 1 }]);
      await expect(
        dbs.collection(TEST_TABLE).insert([{ id: "dup", number: 2 }])
      ).rejects.toMatchObject({
        msg: "ERROR, tried to insert, not unique",
        _code: 1,
      });
      const rows = await dbs
        .collection(TEST_TABLE)
        .findById({ id: "dup" })
        .toArray<{ id: string; number: number }>();
      expect(rows).toEqual([{ id: "dup", number: 1 }]);
    });

    test("insert without a primary key throws NotSupportedByDBEngine", async () => {
      await expect(
        dbs
          .collection(TEST_TABLE)
          .insert([{ number: 1 } as Record<string, unknown>])
      ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
    });
  });

  describe("insertOrUpdate", () => {
    test("insertOrUpdate overwrites existing rows and accepts multi-row payloads", async () => {
      await dbs.collection(TEST_TABLE).insertOrUpdate([
        { id: "ups-1", number: 1 },
        { id: "ups-2", number: 2 },
      ]);
      await dbs.collection(TEST_TABLE).insertOrUpdate([
        { id: "ups-1", number: 11 },
        { id: "ups-2", number: 22 },
      ]);
      const rows = await dbs
        .collection(TEST_TABLE)
        .findByIds({ id: ["ups-1", "ups-2"] })
        .toArray<{ id: string; number: number }>();
      const byId = new Map(rows.map((r) => [r.id, r.number]));
      expect(byId.get("ups-1")).toBe(11);
      expect(byId.get("ups-2")).toBe(22);
    });

    test("insertOrUpdate without a primary key throws NotSupportedByDBEngine", async () => {
      await expect(
        dbs
          .collection(TEST_TABLE)
          .insertOrUpdate([{ number: 1 } as Record<string, unknown>])
      ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
    });
  });

  describe("find", () => {
    test("findById returns an inserted item", async () => {
      const rows = await dbs
        .collection(TEST_TABLE)
        .findById({ id: "a" })
        .toArray<{ id: string; number: number }>();
      expect(rows).toEqual([{ id: "a", number: 1 }]);
    });

    test("findById on a missing id returns []", async () => {
      const rows = await dbs
        .collection(TEST_TABLE)
        .findById({ id: "no-such-id" })
        .toArray();
      expect(rows).toEqual([]);
    });

    test("findByIds returns all matching items", async () => {
      const rows = await dbs
        .collection(TEST_TABLE)
        .findByIds({ id: ["a", "b"] })
        .toArray<{ id: string; number: number }>();
      expect(rows.map((r) => r.id).sort()).toEqual(["a", "b"]);
    });

    test("findByIds with an empty array returns []", async () => {
      const rows = await dbs
        .collection(TEST_TABLE)
        .findByIds({ id: [] })
        .toArray();
      expect(rows).toEqual([]);
    });

    test("findByIds honors limit as a post-fetch cap", async () => {
      const rows = await dbs
        .collection(TEST_TABLE)
        .findByIds({ id: ["a", "b"] }, 1)
        .toArray();
      expect(rows.length).toBe(1);
    });
  });

  describe("count", () => {
    test("count returns the number of matching items", async () => {
      const c = await dbs.collection(TEST_TABLE).find({}).count();
      expect(c).toBeGreaterThanOrEqual(2);
    });
  });

  describe("update", () => {
    test("update mutates matching items", async () => {
      await dbs.collection(TEST_TABLE).update({ id: "a" }, { number: 42 });
      const rows = await dbs
        .collection(TEST_TABLE)
        .findById({ id: "a" })
        .toArray<{ id: string; number: number }>();
      expect(rows).toEqual([{ id: "a", number: 42 }]);
    });

    test("update with an empty change set returns rowCount 0 without an SDK call", async () => {
      const res = await dbs.collection(TEST_TABLE).update({ id: "a" }, {});
      expect(res.rowCount).toBe(0);
    });

    test("updateOne delegates to update", async () => {
      const res = await dbs
        .collection(TEST_TABLE)
        .updateOne({ id: "a" }, { number: 43 });
      expect(res.rowCount).toBe(1);
      const rows = await dbs
        .collection(TEST_TABLE)
        .findById({ id: "a" })
        .toArray<{ id: string; number: number }>();
      expect(rows).toEqual([{ id: "a", number: 43 }]);
    });

    test("update of a non-existent row returns rowCount: 0", async () => {
      const res = await dbs
        .collection(TEST_TABLE)
        .update({ id: "never-seen" }, { number: 99 });
      expect(res.rowCount).toBe(0);
      const rows = await dbs
        .collection(TEST_TABLE)
        .findById({ id: "never-seen" })
        .toArray();
      expect(rows).toEqual([]);
    });

    test("update with a non-primary-key filter throws NotSupportedByDBEngine", async () => {
      await expect(
        dbs.collection(TEST_TABLE).update({ number: 1 }, { tag: "x" })
      ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
    });
  });

  describe("remove", () => {
    test("remove deletes matching items and leaves siblings untouched", async () => {
      await dbs.collection(TEST_TABLE).remove({ id: "b" });
      const removed = await dbs
        .collection(TEST_TABLE)
        .findById({ id: "b" })
        .toArray();
      expect(removed).toEqual([]);
      const sibling = await dbs
        .collection(TEST_TABLE)
        .findById({ id: "a" })
        .toArray<{ id: string }>();
      expect(sibling.map((r) => r.id)).toEqual(["a"]);
    });

    test("remove by id-array deletes multiple items in one call", async () => {
      for (const id of ["batch-1", "batch-2", "batch-3"]) {
        await dbs.collection(TEST_TABLE).insert([{ id }]);
      }
      const res = await dbs
        .collection(TEST_TABLE)
        .remove({ id: ["batch-1", "batch-2", "batch-3"] });
      expect(res.rowCount).toBe(3);
      const remaining = await dbs
        .collection(TEST_TABLE)
        .findByIds({ id: ["batch-1", "batch-2", "batch-3"] })
        .toArray();
      expect(remaining).toEqual([]);
    });

    test("remove with an empty id-array is a no-op returning rowCount 0", async () => {
      const res = await dbs.collection(TEST_TABLE).remove({ id: [] });
      expect(res.rowCount).toBe(0);
    });

    test("remove with >25 ids exercises the 25-item chunking loop", async () => {
      const ids = Array.from({ length: 26 }, (_, i) => `chunk-${i}`);
      await dbs
        .collection(TEST_TABLE)
        .insertOrUpdate(ids.map((id) => ({ id })));
      const res = await dbs.collection(TEST_TABLE).remove({ id: ids });
      expect(res.rowCount).toBe(26);
      const remaining = await dbs
        .collection(TEST_TABLE)
        .findByIds({ id: ids })
        .toArray();
      expect(remaining).toEqual([]);
    });

    test("remove with a non-primary-key filter throws NotSupportedByDBEngine", async () => {
      await expect(
        dbs.collection(TEST_TABLE).remove({ tag: "x" })
      ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
    });

    test("remove with an unsupported operator on the PK throws", async () => {
      await expect(
        dbs
          .collection(TEST_TABLE)
          .remove({ id: { op: "gt", val: 1 } as unknown as Filter })
      ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
    });
  });
});

describe("DynamoDB Query filter operators via Scan", () => {
  const FLT_TABLE = "dynamo_test_filters";
  let dbs: DBS;

  beforeAll(async () => {
    await ensureTable(FLT_TABLE);
    dbs = await connectDynamo(buildConfig());
    await dbs.collection(FLT_TABLE).insertOrUpdate([
      { id: "x1", number: 1, tag: "a" },
      { id: "x2", number: 5, tag: "b" },
      { id: "x3", number: 10, tag: "c" },
      { id: "x4", number: 20 }, // tag is absent
      { id: "x5", number: 25, tag: null }, // tag is explicitly NULL-typed
    ]);
  }, 60000);
  afterAll(async () => {
    await dbs.shutdown();
    await dropTable(FLT_TABLE);
  }, 60000);

  const ids = async (params: Params) =>
    (await dbs.collection(FLT_TABLE).find(params).toArray<{ id: string }>())
      .map((r) => r.id)
      .sort();

  test("Scan on a non-PK filter is served by the Scan path", async () => {
    expect(await ids({ tag: "a" })).toEqual(["x1"]);
  });

  test("exists: true / false filter", async () => {
    expect(await ids({ tag: { op: "exists", val: true } })).toEqual([
      "x1",
      "x2",
      "x3",
      "x5",
    ]);
    expect(await ids({ tag: { op: "exists", val: false } })).toEqual(["x4"]);
  });

  test("null shorthand matches rows where the attribute is absent or explicitly set to null", async () => {
    expect(await ids(p({ tag: null }))).toEqual(["x4", "x5"]);
  });

  test("in / notin on a non-PK attribute", async () => {
    expect(await ids({ tag: { op: "in", val: ["a", "c"] } })).toEqual([
      "x1",
      "x3",
    ]);
    expect(await ids(p({ tag: { op: "notin", val: ["a", "c"] } }))).toEqual([
      "x2",
      "x4",
      "x5",
    ]);
  });

  test("in with empty array short-circuits to []", async () => {
    expect(await ids({ tag: { op: "in", val: [] } })).toEqual([]);
  });

  test("notin with empty array drops the clause (returns all rows)", async () => {
    const allIds = await ids(p({ tag: { op: "notin", val: [] } }));
    expect(allIds.sort()).toEqual(
      expect.arrayContaining(["x1", "x2", "x3", "x4"])
    );
  });

  test("comparison operators: lt, lte, gt, gte", async () => {
    expect(await ids({ number: { op: "lt", val: 5 } })).toEqual(["x1"]);
    expect(await ids({ number: { op: "lte", val: 5 } })).toEqual(["x1", "x2"]);
    expect(await ids({ number: { op: "gt", val: 10 } })).toEqual(["x4", "x5"]);
    expect(await ids({ number: { op: "gte", val: 10 } })).toEqual([
      "x3",
      "x4",
      "x5",
    ]);
  });

  test("and operator combines sub-filters", async () => {
    expect(
      await ids({
        number: {
          op: "and",
          val: [
            { op: "gte", val: 5 },
            { op: "lte", val: 10 },
          ] as Filter[],
        },
      })
    ).toEqual(["x2", "x3"]);
  });

  test("count matches filtered toArray length", async () => {
    const c = await dbs.collection(FLT_TABLE).find({ tag: "a" }).count();
    expect(c).toBe(1);
  });

  test("find on an empty-in at the PK short-circuits to []", async () => {
    const rows = await dbs
      .collection(FLT_TABLE)
      .findByIds({ id: [] })
      .toArray();
    expect(rows).toEqual([]);
  });

  test("Date instances round-trip as-is when the caller stringifies them", async () => {
    const iso = new Date("2024-01-02T03:04:05.000Z").toISOString();
    await dbs.collection(FLT_TABLE).insert([{ id: "date-row", created: iso }]);
    const [row] = await dbs
      .collection(FLT_TABLE)
      .findById({ id: "date-row" })
      .toArray<{ id: string; created: string }>();
    expect(row.created).toBe(iso);
  });
});

describe("DynamoDB Query unsupported operations", () => {
  let dbs: DBS;
  const UNSUP_TABLE = "dynamo_test_unsupported";

  beforeAll(async () => {
    await ensureTable(UNSUP_TABLE);
    dbs = await connectDynamo(buildConfig());
  }, 60000);
  afterAll(async () => {
    await dbs.shutdown();
    await dropTable(UNSUP_TABLE);
  }, 60000);

  test("like operator throws NotSupportedByDBEngine", async () => {
    await expect(
      dbs
        .collection(UNSUP_TABLE)
        .find({ id: { op: "like", val: "%" } })
        .toArray()
    ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
  });

  test("ilike operator throws NotSupportedByDBEngine", async () => {
    await expect(
      dbs
        .collection(UNSUP_TABLE)
        .find({ id: { op: "ilike", val: "%" } })
        .toArray()
    ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
  });

  test("oftype operator throws NotSupportedByDBEngine", async () => {
    await expect(
      dbs
        .collection(UNSUP_TABLE)
        .find({
          id: { op: "oftype", val: { path: ["x"], value: "string" } },
        })
        .toArray()
    ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
  });

  test("find with order throws NotSupportedByDBEngine synchronously", () => {
    expect(() =>
      dbs
        .collection(UNSUP_TABLE)
        .find({}, undefined, undefined, [{ key: "number", dir: "ASC" }])
    ).toThrow(NotSupportedByDBEngine);
  });

  test("find with a numeric offset throws NotSupportedByDBEngine", () => {
    expect(() => dbs.collection(UNSUP_TABLE).find({}, undefined, 10)).toThrow(
      NotSupportedByDBEngine
    );
  });
});
