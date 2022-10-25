import { GenericQueriable } from "../generic";
import { Id, Params } from "../generic";
import { PGConfig } from "../Config";

export abstract class Queriable extends GenericQueriable {
  _config: PGConfig;

  /* ID FUNCTIONS */
  newId() {
    return undefined;
  }

  fromId(id: Id) {
    return id;
  }

  toId(id: Id) {
    return id;
  }

  protected _log(message: string, query: string, params: Params, error: any) {
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
