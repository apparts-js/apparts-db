export type LogFunc = (
  message: string,
  operation: string,
  params: unknown,
  error: unknown,
) => void;
