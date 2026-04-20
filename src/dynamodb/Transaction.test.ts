import { NotSupportedByDBEngine } from "../generic";
import { connectDynamo } from "./index";
import DBS from "./DBS";

const shouldRun = process.env.DB_ENGINE === "dynamodb";
const runOrSkip = shouldRun ? describe : describe.skip;

const TEST_TABLE = "dynamo_test_tx";

const buildConfig = () => ({
  region: "local",
  endpoint: `http://${process.env.DYNAMODB_HOST || "localhost"}:${
    process.env.DYNAMODB_PORT || "8000"
  }`,
  accessKeyId: "local",
  secretAccessKey: "local",
});

runOrSkip("DynamoDB Transaction", () => {
  let dbs: DBS;

  beforeAll(async () => {
    dbs = await connectDynamo(buildConfig());
  });
  afterAll(async () => {
    await dbs.shutdown();
  });

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

  test("nested transactions are not supported", async () => {
    await expect(
      dbs.transaction(async (t) => {
        await (t as unknown as DBS).transaction(async () => undefined);
      })
    ).rejects.toThrow("Can not start new transaction in transaction");
  });

  test("raw SQL inside a transaction is not supported", async () => {
    await expect(
      dbs.transaction(async (t) => {
        await t.raw("SELECT 1");
      })
    ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
  });
});
