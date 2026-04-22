import { NotSupportedByDBEngine } from "../generic";
import { connectDynamo } from "./index";
import DBS from "./DBS";
import Transaction from "./Transaction";
import { ensureTable, dropTable } from "../tests/dynamodb";

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
    await ensureTable(TEST_TABLE);
    dbs = await connectDynamo(buildConfig());
  }, 60000);
  afterAll(async () => {
    await dbs.shutdown();
    await dropTable(TEST_TABLE);
  }, 60000);

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
        await (t as Transaction).transaction();
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

  test("transaction insert of an existing primary key cancels the transaction", async () => {
    await dbs.collection(TEST_TABLE).insert([{ id: "tx-dup", number: 1 }]);
    await expect(
      dbs.transaction(async (t) => {
        await t.collection(TEST_TABLE).insert([{ id: "tx-dup", number: 99 }]);
      })
    ).rejects.toThrow();
    // The pre-existing row is preserved because TransactWriteItems is atomic.
    const rows = await dbs
      .collection(TEST_TABLE)
      .findById({ id: "tx-dup" })
      .toArray<{ id: string; number: number }>();
    expect(rows).toEqual([{ id: "tx-dup", number: 1 }]);
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
});
