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
      [1, 7],
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

describe("createCollection", () => {
  let dbs;
  beforeAll(async () => {
    dbs = await setupDbs();
  });
  afterAll(async () => {
    await teardownDbs(dbs);
  });

  test("Should create a simple table", async () => {
    await dbs.createCollection(
      "simpleTable",
      [],
      [
        { name: "id", type: "SERIAL" },
        { name: "name", type: "TEXT" },
      ],
    );
    await dbs.raw(`INSERT INTO "simpleTable" (name) VALUES ($1)`, ["test"]);
    const { rows } = await dbs.raw(`SELECT * FROM "simpleTable"`);
    expect(rows).toEqual([{ id: 1, name: "test" }]);
  });

  test("Should create a table with NOT NULL constraints", async () => {
    await dbs.createCollection(
      "notNullTable",
      [],
      [
        { name: "id", type: "SERIAL" },
        { name: "number", type: "INT", notNull: true },
      ],
    );
    await expect(
      dbs.raw(`INSERT INTO "notNullTable" (number) VALUES (NULL)`),
    ).rejects.toBeDefined();
    await dbs.raw(`INSERT INTO "notNullTable" (number) VALUES ($1)`, [42]);
    const { rows } = await dbs.raw(`SELECT * FROM "notNullTable"`);
    expect(rows).toEqual([{ id: 2, number: 42 }]);
  });

  test("Should create a table with DEFAULT values", async () => {
    await dbs.createCollection(
      "defaultTable",
      [],
      [
        { name: "id", type: "SERIAL" },
        { name: "status", type: "TEXT", default: "'pending'" },
      ],
    );
    await dbs.raw(`INSERT INTO "defaultTable" (id) VALUES (DEFAULT)`);
    const { rows } = await dbs.raw(`SELECT * FROM "defaultTable"`);
    expect(rows).toEqual([{ id: 1, status: "pending" }]);
  });

  test("Should create a table with primary key", async () => {
    await dbs.createCollection(
      "pkTable",
      [{ name: "id", key: ["id"] }],
      [
        { name: "id", type: "SERIAL" },
        { name: "name", type: "TEXT" },
      ],
    );
    await dbs.raw(`INSERT INTO "pkTable" (name) VALUES ($1)`, ["first"]);
    await expect(
      dbs.raw(`INSERT INTO "pkTable" (id, name) VALUES ($1, $2)`, [
        1,
        "second",
      ]),
    ).rejects.toBeDefined();
  });

  test("Should create a table with unique constraint", async () => {
    await dbs.createCollection(
      "uniqueTable",
      [{ name: "email", unique: true }],
      [
        { name: "id", type: "SERIAL" },
        { name: "email", type: "TEXT" },
      ],
    );
    await dbs.raw(`INSERT INTO "uniqueTable" (email) VALUES ($1)`, ["a@b.com"]);
    await expect(
      dbs.raw(`INSERT INTO "uniqueTable" (email) VALUES ($1)`, ["a@b.com"]),
    ).rejects.toBeDefined();
  });

  test("Should create a table with foreign key constraint", async () => {
    await dbs.createCollection(
      "parentTable",
      [{ name: "id", key: ["id"] }],
      [
        { name: "id", type: "SERIAL" },
        { name: "name", type: "TEXT" },
      ],
    );
    await dbs.createCollection(
      "childTable",
      [{ name: "parentId", foreign: { table: "parentTable", field: "id" } }],
      [
        { name: "id", type: "SERIAL" },
        { name: "parentId", type: "INT" },
      ],
    );
    await dbs.raw(`INSERT INTO "parentTable" (name) VALUES ($1)`, ["parent"]);
    await expect(
      dbs.raw(`INSERT INTO "childTable" ("parentId") VALUES ($1)`, [999]),
    ).rejects.toBeDefined();
    await dbs.raw(`INSERT INTO "childTable" ("parentId") VALUES ($1)`, [1]);
    const { rows } = await dbs.raw(`SELECT * FROM "childTable"`);
    expect(rows).toEqual([{ id: 2, parentId: 1 }]);
  });

  test("Should create a table with prefix", async () => {
    await dbs.createCollection(
      "prefixedTable",
      [],
      [
        { name: "id", type: "SERIAL" },
        { name: "value", type: "INT" },
      ],
      "test",
    );
    const { rows } = await dbs.raw(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'test_prefixedTable'
    `);
    expect(rows.length).toBe(1);
  });
});
