import { GenericQueriable, Id } from "../generic";
import { SqliteConfig } from "./Config";

export abstract class Queriable extends GenericQueriable {
  _config: SqliteConfig;

  newId(): Id {
    return undefined as unknown as Id;
  }

  fromId(id: Id) {
    return id;
  }

  toId(id: Id) {
    return id;
  }

  protected _log(
    message: string,
    query: string,
    params: unknown,
    error: unknown
  ) {
    if (this._config.logs === "errors") {
      if (this._config.logParams) {
        console.log(
          message,
          "\nQUERY:\n",
          query,
          "\nPARAMS:\n",
          params,
          "\nERROR:\n",
          error
        );
      } else {
        console.log(message, "\nQUERY:\n", query, "\nERROR:\n", error);
      }
    }
  }
}
