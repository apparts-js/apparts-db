const { connect } = require("../");
const { dbConfig } = require("../tests/pg")({
  testName: "postgresqltest",
});

describe("Postgresql connect", () => {
  test("Should connect and disconnect", async () => {
    const pool = await connect(dbConfig);
    const pShutdown = pool.shutdown();
    await expect(pShutdown).resolves.not.toThrow();
  });
});
