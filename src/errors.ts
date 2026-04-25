export class DBError extends Error {
  code: number;
  _code: number;
  msg: string;
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
    this._code = code;
    this.msg = message;
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, DBError.prototype);
  }
}

export class UniqueConstraintViolation extends DBError {
  constructor(message?: string) {
    super(message || "ERROR, tried to insert, not unique", 1);
    Object.setPrototypeOf(this, UniqueConstraintViolation.prototype);
  }
}

export class ForeignKeyConstraintViolation extends DBError {
  constructor(message?: string) {
    super(
      message || "ERROR, tried to remove item that is still a reference",
      2
    );
    Object.setPrototypeOf(this, ForeignKeyConstraintViolation.prototype);
  }
}

export class CheckConstraintViolation extends DBError {
  constructor(message?: string) {
    super(message || "ERROR, tried to insert, constraints not met", 3);
    Object.setPrototypeOf(this, CheckConstraintViolation.prototype);
  }
}
