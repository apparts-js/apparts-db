import { Id, Params, Pagination, Result } from "./types";

export abstract class GenericQuery {
  abstract find(params: Params, pagination?: Pagination): this;
  abstract findById(id: Params, pagination?: Pagination): this;
  abstract findByIds(ids: Params, pagination?: Pagination): this;
  abstract toArray<T>(): Promise<T[]>;
  abstract count(): Promise<number>;
  abstract insert<Rs extends string[]>(
    content: Record<string, unknown>[],
    returning?: Rs,
  ): Promise<Record<string, Id>[]>;
  abstract updateOne<T>(
    filter: Params,
    c: Record<string, unknown>,
  ): Promise<Result<T>>;
  abstract update<T>(
    filter: Params,
    c: Record<string, unknown>,
  ): Promise<Result<T>>;
  abstract remove<T>(params: Params): Promise<Result<T>>;
}
