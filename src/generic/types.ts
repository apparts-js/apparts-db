export type Filter =
  | {
      op: "and";
      val: Filter[];
    }
  | {
      op: "in";
      val: (string | number | boolean | null)[];
    }
  | {
      op: "of";
      val: {
        path: string[];
        value: Filter | string | number | boolean | null;
        cast?: "string" | "number" | "boolean" | null;
      };
    }
  | {
      op: "oftype";
      val: {
        path: string[];
        value: "object" | "array" | "string" | "number" | "boolean" | "null";
      };
    }
  | {
      op: "exists";
      val: boolean;
    }
  | {
      op: "lte" | "lt" | "gte" | "gt";
      val: number;
    }
  | {
      op: "like" | "ilike";
      val: string;
    };

export type Params = {
  [u: string]: string | number | boolean | string[] | number[] | Filter | null;
};
export type Id = string | number;
export type Order = { key: string; dir: "ASC" | "DESC"; path?: string[] }[];

export type PaginationCursor = string | Record<string, unknown>;

export type Pagination = {
  limit?: number;
  offset?: number;
  order?: Order;
  cursor?: PaginationCursor;
};

export type Result<T> = {
  rows: T[];
  rowCount?: number | null;
  nextCursor?: PaginationCursor;
};

export type Capabilities = {
  filter: {
    eq: boolean;
    null: boolean;
    in: boolean;
    notin: boolean;
    gt: boolean;
    gte: boolean;
    lt: boolean;
    lte: boolean;
    exists: boolean;
    and: boolean;
    any: boolean;
    like: boolean;
    ilike: boolean;
    jsonPath: boolean;
    jsonType: boolean;
  };
  pagination: {
    limit: boolean;
    offset: boolean;
    cursor: boolean;
    order: boolean;
  };
  mutation: {
    insert: boolean;
    insertBatchAtomic: boolean;
    upsert: boolean;
    updateByFilter: boolean;
    removeByFilter: boolean;
  };
  count: boolean;
  transaction: boolean;
  drop: boolean;
};
