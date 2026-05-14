import setupTest from "../tests/pg";
import type { Pool } from "pg";
import type { PGConfig } from "./Config";
import DBS from "./DBS";
const { setupDbs, teardownDbs } = setupTest({
  testName: "dbstest",
});

describe("Prints errors with params", () => {
  let dbs;
  beforeAll(async () => {
    dbs = await setupDbs({
      logs: "errors",
      logParams: true,
    });
  });
  afterAll(async () => {
    await teardownDbs(dbs);
  });

  test("Should log raw query failure", async () => {
    const logMock = vi.spyOn(console, "log").mockImplementation(() => {
      // nothign
    });
    let error;
    try {
      await dbs.raw(`SELECT FROM "testTable"`, [1, "test"]);
      expect(true).toBe(false);
    } catch (e) {
      error = e;
    }

    expect(logMock.mock.calls).toEqual([
      [
        "Error in dbs.raw",
        "\nQUERY:\n",
        `SELECT FROM "testTable"`,
        "\nPARAMS:\n",
        { params: [1, "test"] },
        "\nERROR:\n",
        error,
      ],
    ]);
    logMock.mockRestore();
  });
});

describe("Prints errors without params", () => {
  let dbs;
  beforeAll(async () => {
    dbs = await setupDbs({ logs: "errors" });
  });
  afterAll(async () => {
    await teardownDbs(dbs);
  });

  test("Should log raw query failure", async () => {
    const logMock = vi.spyOn(console, "log").mockImplementation(() => {
      // nothign
    });
    let error;
    try {
      await dbs.raw(`SELECT FROM "testTable"`, [1, "test"]);
      expect(true).toBe(false);
    } catch (e) {
      error = e;
    }

    expect(logMock.mock.calls).toEqual([
      [
        "Error in dbs.raw",
        "\nQUERY:\n",
        `SELECT FROM "testTable"`,
        "\nERROR:\n",
        error,
      ],
    ]);
    logMock.mockRestore();
  });
});

describe("Postgresql DBS", () => {
  let dbs;
  beforeAll(async () => {
    dbs = await setupDbs();
  });
  afterAll(async () => {
    await teardownDbs(dbs);
  });

  test("Should run raw query", async () => {
    await dbs.raw(`
CREATE TABLE "testTable" (
       id SERIAL PRIMARY KEY,
       number INT NOT NULL
)`);
    await dbs.raw(
      `INSERT INTO "testTable" ( number ) VALUES ($1), ($2)`,
      [1, 7]
    );
    const { rows } = await dbs.raw(`SELECT number FROM "testTable"`);
    expect(rows).toEqual([{ number: 1 }, { number: 7 }]);
  });
});

describe("getCapabilities", () => {
  it("Should return capabilities for PostgreSQL", () => {
    const dbs = new DBS({} as unknown as Pool, {} as unknown as PGConfig);
    const caps = dbs.getCapabilities();

    expect(caps.filter.eq).toBe(true);
    expect(caps.filter.null).toBe(true);
    expect(caps.filter.in).toBe(true);
    expect(caps.filter.notin).toBe(true);
    expect(caps.filter.gt).toBe(true);
    expect(caps.filter.gte).toBe(true);
    expect(caps.filter.lt).toBe(true);
    expect(caps.filter.lte).toBe(true);
    expect(caps.filter.exists).toBe(true);
    expect(caps.filter.and).toBe(true);
    expect(caps.filter.like).toBe(true);
    expect(caps.filter.ilike).toBe(true);
    expect(caps.filter.jsonPath).toBe(true);
    expect(caps.filter.jsonType).toBe(true);
    expect(caps.filter.any).toBe(true);

    expect(caps.pagination.limit).toBe(true);
    expect(caps.pagination.offset).toBe(true);
    expect(caps.pagination.cursor).toBe(false);
    expect(caps.pagination.order).toBe(true);

    expect(caps.mutation.insert).toBe(true);
    expect(caps.mutation.insertBatchAtomic).toBe(true);
    expect(caps.mutation.upsert).toBe(false);
    expect(caps.mutation.updateByFilter).toBe(true);
    expect(caps.mutation.removeByFilter).toBe(true);

    expect(caps.count).toBe(true);
    expect(caps.transaction).toBe(true);
    expect(caps.drop).toBe(true);
  });
});
