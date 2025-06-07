import setupTest from "../tests/pg";
const { setupDbs, teardownDbs } = setupTest({
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
    let transactionMock;
    const res = await dbs.transaction(async (t) => {
      transactionMock = jest.spyOn(t, "end");

      await expect(
        t.collection("testTable").insert([{ number: 100 }])
      ).resolves.toMatchObject([{ id: 1 }]);
      return 123;
    });
    expect(transactionMock.mock.calls.length).toBe(1);

    await expect(
      dbs.collection("testTable").findById({}).toArray()
    ).resolves.toMatchObject([{ id: 1, number: 100 }]);
    expect(res).toBe(123);
  });

  it("should rollback", async () => {
    let transactionMock;
    await expect(() =>
      dbs.transaction(async (t) => {
        transactionMock = jest.spyOn(t, "end");

        await expect(
          t.collection("testTable").insert([{ number: 100 }])
        ).resolves.toMatchObject([{ id: 2 }]);
        throw new Error("Rollback");
      })
    ).rejects.toThrow("Rollback");
    expect(transactionMock.mock.calls.length).toBe(1);
    await expect(
      dbs.collection("testTable").findById({}).toArray()
    ).resolves.toMatchObject([{ id: 1, number: 100 }]);
  });
});
