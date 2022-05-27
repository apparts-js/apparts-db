import { Result, Id } from "./types";
import { GenericQuery } from "./GenericQuery";
import { GenericTransaction } from "./GenericTransaction";

export abstract class GenericDBS {
  abstract newId(): Id;
  abstract fromId(id: Id): Id;
  abstract toId(id: Id): Id;
  abstract collection(col: string): GenericQuery;
  abstract transaction<T>(
    fn: (t: GenericTransaction) => Promise<T>
  ): Promise<T>;
  abstract raw<T>(query: string, params?: any[]): Promise<Result<T>>;
  abstract shutdown(): Promise<void>;
}
