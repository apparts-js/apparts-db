import { connect } from "../";
import setupTest from "../tests/pg";
const { dbConfig } = setupTest({
  testName: "postgresqltest",
});

describe("Postgresql connect", () => {
  test("Should connect and disconnect", async () => {
    const pool = await connect(dbConfig);
    const pShutdown = pool.shutdown();
    await expect(pShutdown).resolves.not.toThrow();
  });
});
