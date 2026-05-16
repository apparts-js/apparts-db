export interface DynamoConfig {
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  logs?: "errors";
  logParams?: boolean;
}
