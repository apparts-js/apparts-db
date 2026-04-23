export type LogFunc = (
  message: string,
  query: string,
  params: unknown,
  error: unknown
) => void;
