import { Result } from "./types";
import { GenericQuery } from "./GenericQuery";

export abstract class GenericTransaction {
  abstract raw<T>(query: string, params?: any[]): Promise<Result<T>>;
  abstract collection(col: string): GenericQuery;
  abstract commit(): Promise<void>;
  abstract rollback(): Promise<void>;
  abstract end(): Promise<void>;
}
