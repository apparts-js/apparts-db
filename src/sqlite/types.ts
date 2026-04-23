import { Params } from "../generic";

export type LogFunc = (
  message: string,
  query: string,
  params: Params | { params?: unknown[] },
  error: unknown
) => void;
