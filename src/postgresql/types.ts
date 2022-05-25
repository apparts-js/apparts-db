export type Params = { [u: string]: any };
export type Id = string | number;
export type Order = { key: string; dir: "ASC" | "DESC"; path?: string[] }[];

export type LogFunc = (
  message: string,
  query: string,
  params: Params,
  error: any
) => void;
