import { GenericQueriable, Id, NotSupportedByDBEngine } from "../generic";
import { DynamoConfig } from "./Config";

export abstract class Queriable extends GenericQueriable {
  _config: DynamoConfig;

  newId(): Id {
    throw new NotSupportedByDBEngine(
      "Queriable.newId: DynamoDB does not auto-generate primary keys; supply your own id on every insert.",
    );
  }

  fromId(id: Id) {
    return id;
  }

  toId(id: Id) {
    return id;
  }

  protected _log(
    message: string,
    operation: string,
    params: unknown,
    error: unknown,
  ) {
    if (this._config.logs === "errors") {
      if (this._config.logParams) {
        console.log(
          message,
          "\nOPERATION:\n",
          operation,
          "\nPARAMS:\n",
          params,
          "\nERROR:\n",
          error,
        );
      } else {
        console.log(message, "\nOPERATION:\n", operation, "\nERROR:\n", error);
      }
    }
  }
}
