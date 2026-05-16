export class NotSupportedByDBEngine extends Error {
  constructor(operation: string) {
    super(`Operation not supported by the selected DB engine: ${operation}`);
    this.name = "NotSupportedByDBEngine";
    Object.setPrototypeOf(this, NotSupportedByDBEngine.prototype);
  }
}
