import { Id, Params, Order, Result } from "./types";

export abstract class GenericQuery {
  abstract find(
    params: Params,
    limit?: number,
    offset?: number,
    order?: Order
  ): this;
  abstract findById(
    id: Params,
    limit?: number,
    offset?: number,
    order?: Order
  ): this;
  abstract findByIds(
    ids: Params,
    limit?: number,
    offset?: number,
    order?: Order
  ): this;
  abstract toArray<T>(): Promise<T[]>;
  abstract insert<Rs extends string[]>(
    content: any[],
    returning?: Rs
  ): Promise<Record<string, Id>[]>;
  abstract updateOne<T>(
    filter: Params,
    c: { [p: string]: any }
  ): Promise<Result<T>>;
  abstract update<T>(
    filter: Params,
    c: { [p: string]: any }
  ): Promise<Result<T>>;
  abstract remove<T>(params: Params): Promise<Result<T>>;
}
