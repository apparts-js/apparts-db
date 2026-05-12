import { connectPG } from "./postgresql";
import { connectDynamo } from "./dynamodb";
import Config from "./Config";

export async function connect(c: Config) {
  if (c.use === "postgresql") {
    return await connectPG(c.postgresql);
  } else if (c.use === "dynamodb") {
    return await connectDynamo(c.dynamodb);
  } else {
    throw "Config references DB-engine that does not exist: " + c.use;
  }
}

export * from "./generic";
export * from "./errors";
