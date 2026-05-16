import { NotSupportedByDBEngine } from "../generic";
import { connectDynamo, createClient } from "./index";
import Query from "./Query";
import { dropTable, ensureTable, buildConfig } from "../tests/dynamodb";

const RAW_TABLE = "dynamo_raw_items";
describe("DynamoDB DBS unsupported operations", () => {
  let dbs: Awaited<ReturnType<typeof connectDynamo>>;

  beforeAll(async () => {
    dbs = await connectDynamo(buildConfig());
  });
  afterAll(async () => {
    await dbs.shutdown();
  });

  test("raw with an unknown operation rejects with NotSupportedByDBEngine", async () => {
    await expect(dbs.raw("SELECT 1")).rejects.toBeInstanceOf(
      NotSupportedByDBEngine
    );
    await expect(
      dbs.raw("NotARealCommand", [{ TableName: "x" }])
    ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
  });

  test("raw rejects when params[0] is not a plain-object input", async () => {
    await expect(dbs.raw("Scan")).rejects.toBeInstanceOf(
      NotSupportedByDBEngine
    );
    await expect(
      dbs.raw("Scan", [null as unknown as object])
    ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
    await expect(
      dbs.raw("Scan", ["string" as unknown as object])
    ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
    await expect(
      dbs.raw("Scan", [[] as unknown as object])
    ).rejects.toBeInstanceOf(NotSupportedByDBEngine);
  });

  test("dropping a table via the query builder is not supported", async () => {
    const q = dbs.collection("anything") as Query;
    await expect(q.drop()).rejects.toBeInstanceOf(NotSupportedByDBEngine);
  });

  test("newId throws: DynamoDB does not auto-generate primary keys", () => {
    expect(() => dbs.newId()).toThrow(NotSupportedByDBEngine);
  });
});

describe("DynamoDB DBS.raw forwards typed requests", () => {
  let dbs: Awaited<ReturnType<typeof connectDynamo>>;

  beforeAll(async () => {
    await ensureTable(RAW_TABLE);
    dbs = await connectDynamo(buildConfig());
    await dbs.collection(RAW_TABLE).insertOrUpdate([
      { id: "raw-a", number: 1 },
      { id: "raw-b", number: 2 },
    ]);
  }, 60000);
  afterAll(async () => {
    await dbs.shutdown();
    await dropTable(RAW_TABLE);
  }, 60000);

  test("raw('Scan', [{TableName}]) returns rows + rowCount", async () => {
    const res = await dbs.raw<{ id: string; number: number }>("Scan", [
      { TableName: RAW_TABLE },
    ]);
    expect(res.rowCount).toBeGreaterThanOrEqual(2);
    const ids = res.rows.map((r) => r.id).sort();
    expect(ids).toEqual(expect.arrayContaining(["raw-a", "raw-b"]));
  });

  test("raw('GetItem', [...]) returns the single row in res.rows", async () => {
    const res = await dbs.raw<{ id: string; number: number }>("GetItem", [
      { TableName: RAW_TABLE, Key: { id: "raw-a" } },
    ]);
    expect(res.rows).toEqual([{ id: "raw-a", number: 1 }]);
    expect(res.rowCount).toBe(1);
  });

  test("raw('GetItem', [...]) on a missing key returns rows: []", async () => {
    const res = await dbs.raw("GetItem", [
      { TableName: RAW_TABLE, Key: { id: "no-such-id" } },
    ]);
    expect(res.rows).toEqual([]);
    expect(res.rowCount).toBe(0);
  });
});

describe("createClient credential validation", () => {
  test("rejects configs where only one of accessKeyId / secretAccessKey is set", () => {
    expect(() =>
      createClient({ region: "local", accessKeyId: "only-access" })
    ).toThrow(/both accessKeyId and secretAccessKey/);
    expect(() =>
      createClient({ region: "local", secretAccessKey: "only-secret" })
    ).toThrow(/both accessKeyId and secretAccessKey/);
  });

  test("accepts a config with no credentials (falls back to AWS default chain)", () => {
    expect(() => createClient({ region: "local" })).not.toThrow();
  });

  test("accepts a config with both credentials set", () => {
    expect(() =>
      createClient({
        region: "local",
        accessKeyId: "a",
        secretAccessKey: "b",
      })
    ).not.toThrow();
  });
});
