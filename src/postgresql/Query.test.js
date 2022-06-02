const { setupDbs, teardownDbs } = require("../tests/pg")({
  testName: "querytest",
});
const DBS = require("./DBS").default;

describe("Log on error behavior", () => {
  let logMock, e, query, dbs;
  beforeEach(() => {
    logMock = jest.spyOn(console, "log").mockImplementation(() => {});
    e = new Error("test");
    query = jest.fn().mockImplementation(async () => {
      throw e;
    });
    dbs = new DBS({}, { logs: "errors", logParams: true });
  });
  afterEach(() => {
    logMock.mockRestore();
  });

  it("Should log on updateOne", async () => {
    const t = dbs.collection("testTable");
    t._dbs = { query };

    await expect(t.updateOne({ number: 100 }, { number: 1000 })).rejects.toBe(
      e
    );
    expect(logMock.mock.calls).toEqual([
      [
        "Error in updateOne:",
        "\nQUERY:\n",
        `UPDATE "testTable" SET "number" = $1 WHERE "number" = $2`,
        "\nPARAMS:\n",
        [1000, 100],
        "\nERROR:\n",
        e,
      ],
    ]);
  });
  it("Should log on remove", async () => {
    const t = dbs.collection("testTable");
    t._dbs = { query };

    await expect(t.remove({ number: 100 })).rejects.toBe(e);
    expect(logMock.mock.calls).toEqual([
      [
        "Error in remove:",
        "\nQUERY:\n",
        `DELETE FROM "testTable" WHERE "number" = $1`,
        "\nPARAMS:\n",
        [100],
        "\nERROR:\n",
        e,
      ],
    ]);
  });
  it("Should log on drop", async () => {
    const t = dbs.collection("testTable");
    t._dbs = { query };

    await expect(t.drop()).rejects.toBe(e);
    expect(logMock.mock.calls).toEqual([
      [
        "Error in drop:",
        "\nQUERY:\n",
        `DROP TABLE "testTable"`,
        "\nPARAMS:\n",
        null,
        "\nERROR:\n",
        e,
      ],
    ]);
  });

  it("Should log on insert", async () => {
    const t = dbs.collection("testTable");
    t._dbs = { query };

    await expect(t.insert([{ a: 2 }])).rejects.toBe(e);
    expect(logMock.mock.calls).toEqual([
      [
        "Error in insert:",
        "\nQUERY:\n",
        `INSERT INTO "testTable" ("a") VALUES ($1) RETURNING "id"`,
        "\nPARAMS:\n",
        [2],
        "\nERROR:\n",
        e,
      ],
    ]);
  });

  it("Should log on find", async () => {
    const t = dbs.collection("testTable");
    t._dbs = { query };

    await expect(t.find({ a: 2 }).toArray()).rejects.toBe(e);
    expect(logMock.mock.calls).toEqual([
      [
        "Error in toArray:",
        "\nQUERY:\n",
        `SELECT * FROM "testTable" WHERE "a" = $1`,
        "\nPARAMS:\n",
        [2],
        "\nERROR:\n",
        e,
      ],
    ]);
  });
  it("Should log on findById", async () => {
    const t = dbs.collection("testTable");
    t._dbs = { query };

    await expect(t.findById({ a: 2 }).toArray()).rejects.toBe(e);
    expect(logMock.mock.calls).toEqual([
      [
        "Error in toArray:",
        "\nQUERY:\n",
        `SELECT * FROM "testTable" WHERE "a" = $1`,
        "\nPARAMS:\n",
        [2],
        "\nERROR:\n",
        e,
      ],
    ]);
  });
  it("Should log on findByIds", async () => {
    const t = dbs.collection("testTable");
    t._dbs = { query };

    await expect(t.findByIds({ id: [2] }).toArray()).rejects.toBe(e);
    expect(logMock.mock.calls).toEqual([
      [
        "Error in toArray:",
        "\nQUERY:\n",
        `SELECT * FROM "testTable" WHERE "id" IN ($1)`,
        "\nPARAMS:\n",
        [2],
        "\nERROR:\n",
        e,
      ],
    ]);
  });
});

let dbs;
beforeAll(async () => {
  dbs = await setupDbs({ logs: "errors" });
  await dbs.raw(`
CREATE TABLE "testTable" (
       id SERIAL PRIMARY KEY,
       number INT NOT NULL
)`);
  await dbs.raw(`
CREATE TABLE "testTable2" (
       id SERIAL PRIMARY KEY,
       "testTableId" INT NOT NULL,
       FOREIGN KEY ("testTableId") REFERENCES "testTable"(id)
)`);
  await dbs.raw(`
CREATE TABLE "testTable3" (
       id SERIAL PRIMARY KEY,
       "object1" json NOT NULL
)`);
});
afterAll(async () => {
  await teardownDbs(dbs);
});

describe("Insert", () => {
  it("Should insert nothing", async () => {
    await expect(dbs.collection("testTable").insert([])).resolves.toMatchObject(
      []
    );
  });
  it("Should insert one thing", async () => {
    await expect(
      dbs.collection("testTable").insert([{ number: 100 }])
    ).resolves.toMatchObject([{ id: 1 }]);
  });

  it("Should insert multiple things", async () => {
    await expect(
      dbs.collection("testTable").insert([{ number: 101 }, { number: 102 }])
    ).resolves.toMatchObject([{ id: 2 }, { id: 3 }]);
  });
  it("Should fail to insert non-unique content", async () => {
    await expect(
      dbs.collection("testTable").insert([{ number: 100, id: 1 }])
    ).rejects.toMatchObject({
      msg: "ERROR, tried to insert, not unique",
      _code: 1,
    });
  });
  it("Should fail to insert with unmet foreign constraint", async () => {
    await expect(
      dbs.collection("testTable2").insert([{ testTableId: 10000 }])
    ).rejects.toMatchObject({
      msg: "ERROR, tried to insert, constraints not met",
      _code: 3,
    });
    await expect(
      dbs.collection("testTable2").find({}).toArray()
    ).resolves.toStrictEqual([]);
  });
  it("Should insert json", async () => {
    await expect(
      dbs.collection("testTable3").insert([
        {
          object1: {
            object2: { tokens: "abc" },
            aNumber: 333,
            aBool: true,
            aString: "Abc",
          },
        },
      ])
    ).resolves.toStrictEqual([{ id: 1 }]);

    await expect(
      dbs.collection("testTable3").insert([{ object1: { tokens: "abc" } }])
    ).resolves.toStrictEqual([{ id: 2 }]);
  });
});

describe("Find / findById", () => {
  it("Should findById", async () => {
    await expect(
      dbs.collection("testTable").findById({ id: 1 }).toArray()
    ).resolves.toMatchObject([{ id: 1, number: 100 }]);
  });
  it("Should findById nothing", async () => {
    await expect(
      dbs.collection("testTable").findById({ id: 100 }).toArray()
    ).resolves.toMatchObject([]);
  });

  it("Should findById with multiple keys given", async () => {
    await expect(
      dbs.collection("testTable").findById({ id: 1, number: 100 }).toArray()
    ).resolves.toMatchObject([{ id: 1, number: 100 }]);
  });

  it("Should findById nothing with multiple keys", async () => {
    await expect(
      dbs.collection("testTable").findById({ id: 1, number: 101 }).toArray()
    ).resolves.toMatchObject([]);
  });

  it("Should findById everything", async () => {
    await expect(
      dbs.collection("testTable").findById({}).toArray()
    ).resolves.toMatchObject([
      { id: 1, number: 100 },
      { id: 2, number: 101 },
      { id: 3, number: 102 },
    ]);
  });

  it("Should findById with limit", async () => {
    await expect(
      dbs.collection("testTable").findById({}, 1).toArray()
    ).resolves.toMatchObject([{ id: 1, number: 100 }]);
  });

  it("Should findById with limit and offset", async () => {
    await expect(
      dbs.collection("testTable").findById({}, 1, 1).toArray()
    ).resolves.toMatchObject([{ id: 2, number: 101 }]);
  });
});

describe("Filters", () => {
  it("Should findById with gt operator", async () => {
    await expect(
      dbs
        .collection("testTable")
        .findById({ number: { op: "gt", val: 100 } })
        .toArray()
    ).resolves.toMatchObject([
      { id: 2, number: 101 },
      { id: 3, number: 102 },
    ]);
  });

  it("Should findById with lt operator", async () => {
    await expect(
      dbs
        .collection("testTable")
        .findById({ number: { op: "lt", val: 102 } })
        .toArray()
    ).resolves.toMatchObject([
      { id: 1, number: 100 },
      { id: 2, number: 101 },
    ]);
  });

  it("Should findByIds with gte operator", async () => {
    await expect(
      dbs
        .collection("testTable")
        .findById({ number: { op: "gte", val: 101 } })
        .toArray()
    ).resolves.toMatchObject([
      { id: 2, number: 101 },
      { id: 3, number: 102 },
    ]);
  });
  it("Should findByIds with lte operator", async () => {
    await expect(
      dbs
        .collection("testTable")
        .findById({ number: { op: "lte", val: 101 } })
        .toArray()
    ).resolves.toMatchObject([
      { id: 1, number: 100 },
      { id: 2, number: 101 },
    ]);
  });

  it("Should find with of operator, multiple levels deep", async () => {
    await expect(
      dbs
        .collection("testTable3")
        .find({
          object1: {
            op: "of",
            val: {
              path: ["object2", "tokens"],
              value: "abc",
            },
          },
        })
        .toArray()
    ).resolves.toMatchObject([
      { id: 1, object1: { object2: { tokens: "abc" } } },
    ]);
  });
  it("Should find with of operator, one level deep", async () => {
    await expect(
      dbs
        .collection("testTable3")
        .find({
          object1: {
            op: "of",
            val: {
              path: ["tokens"],
              value: "abc",
            },
          },
        })
        .toArray()
    ).resolves.toMatchObject([{ id: 2, object1: { tokens: "abc" } }]);
  });
  it("Should fail to find with of operator, no level deep", async () => {
    expect(async () => {
      await dbs
        .collection("testTable3")
        .find({
          object1: {
            op: "of",
            val: {
              path: [],
              value: "abc",
            },
          },
        })
        .toArray();
    }).rejects.toThrow(
      "ERROR, JSON path requires at least one path element. You submitted []."
    );
  });
  it("Should find with of operator, with sub operator", async () => {
    await expect(
      dbs
        .collection("testTable3")
        .find({
          object1: {
            op: "of",
            val: {
              path: ["tokens"],
              value: { op: "like", val: "%b%" },
            },
          },
        })
        .toArray()
    ).resolves.toMatchObject([{ id: 2, object1: { tokens: "abc" } }]);
  });

  it("find with multiple of operators and suboperator and boolean", async () => {
    await expect(
      dbs
        .collection("testTable3")
        .find({
          object1: {
            op: "and",
            val: [
              {
                op: "of",
                val: {
                  path: ["aNumber"],
                  cast: "number",
                  value: { op: "gt", val: 44 },
                },
              },
              {
                op: "of",
                val: {
                  path: ["aBool"],
                  value: true,
                },
              },
            ],
          },
        })
        .toArray()
    ).resolves.toMatchObject([{ object1: { aNumber: 333 } }]);
  });

  it("Should find null value", async () => {
    await dbs.raw(`
CREATE TABLE "testTableWithOpt" (
       id SERIAL PRIMARY KEY,
       number INT NOT NULL,
       "optionalVal" INT
)`);
    await dbs.collection("testTableWithOpt").insert([
      {
        number: 1337,
        optionalVal: 7,
      },
      {
        number: 1337,
      },
    ]);

    await expect(
      dbs
        .collection("testTableWithOpt")
        .find({
          number: 1337,
          optionalVal: null,
        })
        .toArray()
    ).resolves.toStrictEqual([{ id: 2, number: 1337, optionalVal: null }]);
  });
});
describe("FindByIds", () => {
  it("Should findByIds with array", async () => {
    await expect(
      dbs
        .collection("testTable")
        .findByIds({ id: [1] })
        .toArray()
    ).resolves.toMatchObject([{ id: 1, number: 100 }]);
  });
  it("Should findByIds without array", async () => {
    await expect(
      dbs.collection("testTable").findByIds({ id: 1 }).toArray()
    ).resolves.toMatchObject([{ id: 1, number: 100 }]);
  });
  it("Should findByIds nothing without array", async () => {
    await expect(
      dbs
        .collection("testTable")
        .findByIds({ id: [100] })
        .toArray()
    ).resolves.toMatchObject([]);
  });
  it("Should findByIds with multiple arrays", async () => {
    await expect(
      dbs
        .collection("testTable")
        .findByIds({ id: [1], number: [100] })
        .toArray()
    ).resolves.toMatchObject([{ id: 1, number: 100 }]);
  });
  it("Should findByIds nothing with multiple arrays", async () => {
    await expect(
      dbs
        .collection("testTable")
        .findByIds({ id: [1], number: [101] })
        .toArray()
    ).resolves.toMatchObject([]);
  });
  it("Should findByIds everything", async () => {
    await expect(
      dbs.collection("testTable").findByIds({}).toArray()
    ).resolves.toMatchObject([
      { id: 1, number: 100 },
      { id: 2, number: 101 },
      { id: 3, number: 102 },
    ]);
  });
  it("Should findByIds with array with multiple ids", async () => {
    await expect(
      dbs
        .collection("testTable")
        .findByIds({ id: [1, 2, 3] })
        .toArray()
    ).resolves.toMatchObject([
      { id: 1, number: 100 },
      { id: 2, number: 101 },
      { id: 3, number: 102 },
    ]);
  });
  it("Should findByIds with array with multiple ids and limit", async () => {
    await expect(
      dbs
        .collection("testTable")
        .findByIds({ id: [1, 2, 3] }, 1)
        .toArray()
    ).resolves.toMatchObject([{ id: 1, number: 100 }]);
  });
  it("Should findByIds with array with multiple ids and limit and offset", async () => {
    await expect(
      dbs
        .collection("testTable")
        .findByIds({ id: [1, 2, 3] }, 1, 1)
        .toArray()
    ).resolves.toMatchObject([{ id: 2, number: 101 }]);
  });
  it("Should findByIds with empty array", async () => {
    await expect(
      dbs.collection("testTable").findByIds({ id: [] }).toArray()
    ).resolves.toMatchObject([]);
  });
});

describe("Find ordered", () => {
  it("Should find in desc order", async () => {
    await expect(
      dbs.collection("testTable").insert([{ number: 100 }])
    ).resolves.toMatchObject([{ id: 4 }]);

    await expect(
      dbs
        .collection("testTable")
        .findById({}, null, null, [{ key: "id", dir: "DESC" }])
        .toArray()
    ).resolves.toMatchObject([
      { id: 4, number: 100 },
      { id: 3, number: 102 },
      { id: 2, number: 101 },
      { id: 1, number: 100 },
    ]);
  });
  it("Should find in asc order", async () => {
    await expect(
      dbs
        .collection("testTable")
        .findById({}, null, null, [
          { key: "number", dir: "ASC" },
          { key: "id", dir: "DESC" },
        ])
        .toArray()
    ).resolves.toMatchObject([
      { id: 4, number: 100 },
      { id: 1, number: 100 },
      { id: 2, number: 101 },
      { id: 3, number: 102 },
    ]);
  });
});

describe("Update", () => {
  it("Should updateOne", async () => {
    await expect(
      dbs.collection("testTable").updateOne({ number: 100 }, { number: 1000 })
    ).resolves.toMatchObject({ rowCount: 2 });

    await expect(
      dbs
        .collection("testTable")
        .updateOne({ number: 101, id: 2 }, { number: 3000, id: 5 })
    ).resolves.toMatchObject({ rowCount: 1 });

    await expect(
      dbs
        .collection("testTable")
        .findByIds({ id: [1, 2, 3, 4, 5] })
        .toArray()
    ).resolves.toMatchObject([
      { id: 1, number: 1000 },
      { id: 3, number: 102 },
      { id: 4, number: 1000 },
      { id: 5, number: 3000 },
    ]);
  });
  it("Should updateOne all", async () => {
    await expect(
      dbs.collection("testTable").updateOne({}, { number: 2000 })
    ).resolves.toMatchObject({ rowCount: 4 });

    await expect(
      dbs
        .collection("testTable")
        .findByIds({ id: [1, 5, 3] })
        .toArray()
    ).resolves.toMatchObject([
      { id: 1, number: 2000 },
      { id: 3, number: 2000 },
      { id: 5, number: 2000 },
    ]);
  });
  it("Should fail to updateOne due to uniqueness constraint", async () => {
    await expect(
      dbs.collection("testTable").updateOne({}, { id: 1 })
    ).rejects.toMatchObject({
      msg: "ERROR, tried to update, not unique",
      _code: 1,
    });
  });
});

describe("Remove", () => {
  it("Should remove", async () => {
    await expect(
      dbs.collection("testTable").remove({ number: 2000, id: 5 })
    ).resolves.toMatchObject({ rowCount: 1 });

    await expect(
      dbs
        .collection("testTable")
        .findByIds({ id: [1, 2, 3, 5] })
        .toArray()
    ).resolves.toMatchObject([
      { id: 1, number: 2000 },
      { id: 3, number: 2000 },
    ]);
  });
  it("Should fail to remove due to foreign key constraint", async () => {
    await expect(
      dbs.collection("testTable2").insert([{ testTableId: 3 }])
    ).resolves.toMatchObject([{ id: 2 }]);

    await expect(
      dbs.collection("testTable").remove({ number: 2000 })
    ).rejects.toMatchObject({
      msg: "ERROR, tried to remove item that is still a reference",
      _code: 2,
    });

    await expect(
      dbs.collection("testTable2").remove({})
    ).resolves.toMatchObject({ rowCount: 1 });

    await expect(
      dbs.collection("testTable").remove({ number: 2000 })
    ).resolves.toMatchObject({ rowCount: 3 });

    await expect(
      dbs
        .collection("testTable")
        .findByIds({ id: [1, 2, 3, 4] })
        .toArray()
    ).resolves.toMatchObject([]);
  });
  it("Should remove nothing", async () => {
    await expect(
      dbs.collection("testTable").remove({ number: 2000 })
    ).resolves.toMatchObject({ rowCount: 0 });
  });
});

describe("Table", () => {
  it("Should drop", async () => {
    await expect(dbs.collection("testTable2").drop()).resolves.toMatchObject(
      {}
    );
    const logMock = jest.spyOn(console, "log").mockImplementation(() => {});
    await expect(
      dbs.collection("testTable2").findByIds({}).toArray()
    ).rejects.toMatchObject({ code: "42P01" });
    logMock.mockRestore();
  });
});

describe("Postgresql Query JSON Data types", () => {
  let dbs;
  beforeAll(async () => {
    dbs = await setupDbs({ logs: "errors", arrayAsJSON: true });
  });
  afterAll(async () => {
    await teardownDbs(dbs);
  });

  it("Should insert", async () => {
    await dbs.raw(`
CREATE TABLE "testJson" (
       id SERIAL PRIMARY KEY,
       "jsonField" json,
       "jsonArray" json
)`);

    await expect(
      dbs
        .collection("testJson")
        .insert([{ jsonField: { a: 1 }, jsonArray: [1, 2, 3] }])
    ).resolves.toMatchObject([{ id: 1 }]);
  });
  it("Should update/updateOne", async () => {
    await expect(
      dbs.collection("testJson").updateOne({ id: 1 }, { jsonArray: [1, 2, 4] })
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it("Should find", async () => {
    await expect(
      dbs.collection("testJson").find({}).toArray()
    ).resolves.toMatchObject([
      { id: 1, jsonArray: [1, 2, 4], jsonField: { a: 1 } },
    ]);
  });

  it("Should find ordered", async () => {
    await dbs
      .collection("testJson")
      .insert([
        { jsonField: { field: { subfield: 1 } } },
        { jsonField: { field: { subfield: "a" } } },
        { jsonField: { field: { subfield: 343 } } },
        { jsonField: { field: { subfield: "bc" } } },
        { jsonField: { field: { subfield: "ba" } } },
        { jsonField: { field: "3" } },
      ]);

    await expect(
      dbs
        .collection("testJson")
        .find({}, undefined, undefined, [
          {
            key: "jsonField",
            path: ["field", "subfield"],
            dir: "ASC",
          },
        ])
        .toArray()
    ).resolves.toMatchObject([
      { id: 2, jsonField: { field: { subfield: 1 } } },
      { id: 4, jsonField: { field: { subfield: 343 } } },
      { id: 3, jsonField: { field: { subfield: "a" } } },
      { id: 6, jsonField: { field: { subfield: "ba" } } },
      { id: 5, jsonField: { field: { subfield: "bc" } } },
      { id: 1, jsonField: { a: 1 } },
      { id: 7, jsonField: { field: "3" } },
    ]);
  });
});

describe("Postgresql Query Non-JSON Data types", () => {
  let dbs;
  beforeAll(async () => {
    dbs = await setupDbs({ logs: "errors" });
  });
  afterAll(async () => {
    await teardownDbs(dbs);
  });

  it("Should insert", async () => {
    await dbs.raw(`
CREATE TABLE "testNonJson" (
       id SERIAL PRIMARY KEY,
       "jsonField" json,
       "nonJsonArray" integer[]
)`);

    await expect(
      dbs
        .collection("testNonJson")
        .insert([{ jsonField: { a: 1 }, nonJsonArray: [1, 2, 3] }])
    ).resolves.toMatchObject([{ id: 1 }]);
  });

  it("Should update/updateOne", async () => {
    await expect(
      dbs
        .collection("testNonJson")
        .updateOne({ id: 1 }, { nonJsonArray: [1, 2, 4] })
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it("Should find", async () => {
    await expect(
      dbs.collection("testNonJson").find({}).toArray()
    ).resolves.toMatchObject([
      { id: 1, nonJsonArray: [1, 2, 4], jsonField: { a: 1 } },
    ]);
  });
});
