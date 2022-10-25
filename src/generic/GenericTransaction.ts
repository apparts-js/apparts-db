import { GenericQueriable } from "./GenericQueriable";

export abstract class GenericTransaction extends GenericQueriable {
  abstract commit(): Promise<void>;
  abstract rollback(): Promise<void>;
  abstract end(): Promise<void>;
  async transaction<T>(): Promise<T> {
    throw new Error("Can not start new transaction in transaction");
  }
}
