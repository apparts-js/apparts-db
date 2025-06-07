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
  [u: string]: string | number | boolean | string[] | number[] | Filter;
};
export type Id = string | number;
export type Order = { key: string; dir: "ASC" | "DESC"; path?: string[] }[];

export type Result<T> = {
  rows: T[];
  rowCount?: number;
};
