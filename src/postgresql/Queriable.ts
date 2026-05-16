import { GenericQueriable } from "../generic";
import { Id } from "../generic";
import { Params } from "./types";
import { PGConfig } from "./Config";

export abstract class Queriable extends GenericQueriable {
  _config!: PGConfig;

  /* ID FUNCTIONS */
  newId(): Id | undefined {
    return undefined;
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
    params: Params | unknown[] | null,
    error: unknown,
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
          error,
        );
      } else {
        console.log(message, "\nQUERY:\n", query, "\nERROR:\n", error);
      }
    }
  }
}
