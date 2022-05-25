const { setupDbs, teardownDbs } = require("../tests/pg")({
  testName: "transactiontest",
});

describe("Postgresql Transaction", () => {
  let dbs;
  beforeAll(async () => {
    dbs = await setupDbs({ logs: "errors" });
    await dbs.raw(`
CREATE TABLE "testTable" (
       id SERIAL PRIMARY KEY,
       number INT NOT NULL
)`);
  });
  afterAll(async () => {
    await teardownDbs(dbs);
  });

  test("Should commit", async () => {
    await dbs.transaction(async (t) => {
      await expect(
        t.collection("testTable").insert([{ number: 100 }])
      ).resolves.toMatchObject([{ id: 1 }]);
    });
    await expect(
      dbs.collection("testTable").findById({}).toArray()
    ).resolves.toMatchObject([{ id: 1, number: 100 }]);
  });

  it("should rollback", async () => {
    await dbs.transaction(async (t) => {
      await expect(
        t.collection("testTable").insert([{ number: 100 }])
      ).resolves.toMatchObject([{ id: 2 }]);
      throw new Error("Rollback");
    });
    await expect(
      dbs.collection("testTable").findById({}).toArray()
    ).resolves.toMatchObject([{ id: 1, number: 100 }]);
  });
});
