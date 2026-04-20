import { NotSupportedByDBEngine } from "../generic";
import { connectDynamo } from "./index";
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
});
