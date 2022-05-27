export type Params = { [u: string]: any };
export type Id = string | number;
export type Order = { key: string; dir: "ASC" | "DESC"; path?: string[] }[];

export type Result<T> = {
  rows: T[];
  rowCount?: number;
};
