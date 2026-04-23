export interface SqliteConfig {
  filename: string;
  readonly?: boolean;
  fileMustExist?: boolean;
  timeout?: number;
  logs?: "errors";
  logParams?: boolean;
  arrayAsJSON?: boolean;
}
