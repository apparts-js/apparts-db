import { NotSupportedByDBEngine } from "../generic";
import { connectDynamo } from "./index";
import DBS from "./DBS";
import { ensureTable, dropTable } from "../tests/dynamodb";

const shouldRun = process.env.DB_ENGINE === "dynamodb";
const runOrSkip = shouldRun ? describe : describe.skip;

const TEST_TABLE = "dynamo_test_items";

const buildConfig = () => ({
  region: "local",
  endpoint: `http://${process.env.DYNAMODB_HOST || "localhost"}:${
    process.env.DYNAMODB_PORT || "8000"
  }`,
  accessKeyId: "local",
  secretAccessKey: "local",
});

runOrSkip("DynamoDB Query CRUD", () => {
  let dbs: DBS;

  beforeAll(async () => {
    await ensureTable(TEST_TABLE);
    dbs = await connectDynamo(buildConfig());
  }, 60000);
  afterAll(async () => {
    await dbs.shutdown();
    await dropTable(TEST_TABLE);
  }, 60000);

  test("insert returns the primary key of inserted items", async () => {
    const ids = await dbs.collection(TEST_TABLE).insert([
      { id: "a", number: 1 },
      { id: "b", number: 2 },
    ]);
    expect(ids.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  test("findById returns an inserted item", async () => {
    const rows = await dbs
      .collection(TEST_TABLE)
      .findById({ id: "a" })
      .toArray<{ id: string; number: number }>();
    expect(rows).toEqual([{ id: "a", number: 1 }]);
  });

  test("findByIds returns all matching items", async () => {
    const rows = await dbs
      .collection(TEST_TABLE)
      .findByIds({ id: ["a", "b"] })
      .toArray<{ id: string; number: number }>();
    expect(rows.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  test("count returns the number of matching items", async () => {
    const c = await dbs.collection(TEST_TABLE).find({}).count();
    expect(c).toBeGreaterThanOrEqual(2);
  });

  test("update mutates matching items", async () => {
    await dbs.collection(TEST_TABLE).update({ id: "a" }, { number: 42 });
    const rows = await dbs
      .collection(TEST_TABLE)
      .findById({ id: "a" })
      .toArray<{ id: string; number: number }>();
    expect(rows).toEqual([{ id: "a", number: 42 }]);
  });

  test("remove deletes matching items", async () => {
    await dbs.collection(TEST_TABLE).remove({ id: "b" });
    const rows = await dbs
      .collection(TEST_TABLE)
      .findById({ id: "b" })
      .toArray();
    expect(rows).toEqual([]);
  });

  test("insert rejects duplicate primary keys with _code: 1", async () => {
    await dbs.collection(TEST_TABLE).insert([{ id: "dup", number: 1 }]);
    await expect(
      dbs.collection(TEST_TABLE).insert([{ id: "dup", number: 2 }])
    ).rejects.toMatchObject({
      msg: "ERROR, tried to insert, not unique",
      _code: 1,
    });
    // Original row is preserved.
    const rows = await dbs
      .collection(TEST_TABLE)
      .findById({ id: "dup" })
      .toArray<{ id: string; number: number }>();
    expect(rows).toEqual([{ id: "dup", number: 1 }]);
  });

  test("update of a non-existent row returns rowCount: 0", async () => {
    const res = await dbs
      .collection(TEST_TABLE)
      .update({ id: "never-seen" }, { number: 99 });
    expect(res.rowCount).toBe(0);
    // No upsert happened.
    const rows = await dbs
      .collection(TEST_TABLE)
      .findById({ id: "never-seen" })
      .toArray();
    expect(rows).toEqual([]);
  });
});

runOrSkip("DynamoDB Query unsupported operators", () => {
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
});
