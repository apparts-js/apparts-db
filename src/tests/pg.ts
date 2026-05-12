import { Client } from "pg";
import { connect } from "..";
import config from "@apparts/config";
import { GenericDBS } from "../generic";

const _dbConfig = config.get("db-test-config");
const dbConfig = {
  ..._dbConfig,
  postgresql: {
    ..._dbConfig.postgresql,
    password: _dbConfig.postgresql.pw,
  },
};

const createOrDropDatabase = async (
  action: "CREATE" | "DROP",
  db_config: Record<string, unknown>,
  dbName: string
) => {
  const config = { ...db_config };
  config.database = "postgres";
  const client = new Client(config);
  client.on("error", async (err) => {
    console.log("COULD NOT " + action + " DATABASE " + dbName + ": " + err);
    await client.end.bind(client);
    throw "COULD NOT " + action + " DATABASE " + dbName + ": " + err;
  });
  await client.connect();

  const escapedDbName = dbName.replace(/"/g, '""');
  const sql = action + ' DATABASE "' + escapedDbName + '"';
  try {
    await client.query(sql);
  } catch (e) {
    await client.end();
    throw e;
  }
  await client.end();
};

export default ({ testName }: { testName: string }) => {
  const dbName = dbConfig.postgresql.db + "_" + testName;

  beforeAll(async () => {
    try {
      await createOrDropDatabase("DROP", dbConfig.postgresql, dbName);
    } catch (e: unknown) {
      if (
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        (e as { code: string }).code !== "3D000"
      ) {
        console.log(e);
      }
    }
    try {
      await createOrDropDatabase("CREATE", dbConfig.postgresql, dbName);
    } catch (e) {
      console.log("ERROR", e);
      throw e;
    }
  }, 60000);

  afterAll(async () => {
    // 500ms settle to avoid open-handle warnings seen with supertest
    // https://github.com/visionmedia/supertest/issues/520#issuecomment-469044925
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 500));
  }, 60000);

  return {
    dbName,
    dbConfig: {
      ...dbConfig,
      postgresql: {
        ...dbConfig.postgresql,
        db: dbName,
      },
    },
    setupDbs: async (config?: Record<string, unknown>) => {
      return await connect({
        ...dbConfig,
        postgresql: {
          ...dbConfig.postgresql,
          db: dbName,
          ...config,
        },
      });
    },

    teardownDbs: async (dbs: GenericDBS) => {
      await dbs.shutdown();
    },
  };
};
