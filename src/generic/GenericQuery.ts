import { Id, Params, Order, Pagination, Result } from "./types";

export abstract class GenericQuery {
  abstract find(params: Params, pagination?: Pagination): this;
  abstract find(
    params: Params,
    limit?: number,
    offset?: number,
    order?: Order
  ): this;
  abstract find(
    params: Params,
    limitOrPagination?: number | Pagination,
    offset?: number,
    order?: Order
  ): this;
  abstract findById(id: Params, pagination?: Pagination): this;
  abstract findById(
    id: Params,
    limit?: number,
    offset?: number,
    order?: Order
  ): this;
  abstract findById(
    id: Params,
    limitOrPagination?: number | Pagination,
    offset?: number,
    order?: Order
  ): this;
  abstract findByIds(ids: Params, pagination?: Pagination): this;
  abstract findByIds(
    ids: Params,
    limit?: number,
    offset?: number,
    order?: Order
  ): this;
  abstract findByIds(
    ids: Params,
    limitOrPagination?: number | Pagination,
    offset?: number,
    order?: Order
  ): this;
  abstract toArray<T>(): Promise<T[]>;
  abstract count(): Promise<number>;
  abstract insert<Rs extends string[]>(
    content: Record<string, unknown>[],
    returning?: Rs
  ): Promise<Record<string, Id>[]>;
  abstract updateOne<T>(
    filter: Params,
    c: Record<string, unknown>
  ): Promise<Result<T>>;
  abstract update<T>(
    filter: Params,
    c: Record<string, unknown>
  ): Promise<Result<T>>;
  abstract remove<T>(params: Params): Promise<Result<T>>;
}
