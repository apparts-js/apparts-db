import { NotSupportedByDBEngine } from "../generic";
import DBS from "./DBS";
import Query from "./Query";

const shouldRun = process.env.DB_ENGINE === "dynamodb";
const runOrSkip = shouldRun ? describe : describe.skip;

runOrSkip("DynamoDB DBS unsupported operations", () => {
  let dbs: DBS;
  beforeAll(() => {
    dbs = new DBS(
      {},
      {
        region: "local",
        endpoint: "http://localhost:8000",
        accessKeyId: "local",
        secretAccessKey: "local",
      }
    );
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
