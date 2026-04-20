import { Params } from "../generic";

export type LogFunc = (
  message: string,
  operation: string,
  params: Params | { params: unknown },
  error: unknown
) => void;
