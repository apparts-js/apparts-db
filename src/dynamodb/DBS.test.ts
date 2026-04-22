import { NotSupportedByDBEngine } from "../generic";
import { connectDynamo, createClient } from "./index";
import Query from "./Query";

const shouldRun = process.env.DB_ENGINE === "dynamodb";
const runOrSkip = shouldRun ? describe : describe.skip;

const buildConfig = () => ({
  region: "local",
  endpoint: `http://${process.env.DYNAMODB_HOST || "localhost"}:${
    process.env.DYNAMODB_PORT || "8000"
  }`,
  accessKeyId: "local",
  secretAccessKey: "local",
});

runOrSkip("DynamoDB DBS unsupported operations", () => {
  let dbs: Awaited<ReturnType<typeof connectDynamo>>;

  beforeAll(async () => {
    dbs = await connectDynamo(buildConfig());
  });
  afterAll(async () => {
    await dbs.shutdown();
  });

  test("raw SQL queries are not supported", async () => {
    await expect(dbs.raw("SELECT 1")).rejects.toBeInstanceOf(
      NotSupportedByDBEngine
    );
  });

  test("dropping a table via the query builder is not supported", async () => {
    const q = dbs.collection("anything") as Query;
    await expect(q.drop()).rejects.toBeInstanceOf(NotSupportedByDBEngine);
  });

  test("newId throws: DynamoDB does not auto-generate primary keys", () => {
    expect(() => dbs.newId()).toThrow(NotSupportedByDBEngine);
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
