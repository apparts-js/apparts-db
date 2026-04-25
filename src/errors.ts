export class DBError extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
    Object.setPrototypeOf(this, DBError.prototype);
  }
}

export class UniqueConstraintViolation extends DBError {
  constructor() {
    super("ERROR, tried to insert, not unique", 1);
    Object.setPrototypeOf(this, UniqueConstraintViolation.prototype);
  }
}

export class ForeignKeyConstraintViolation extends DBError {
  constructor() {
    super("ERROR, tried to remove item that is still a reference", 2);
    Object.setPrototypeOf(this, ForeignKeyConstraintViolation.prototype);
  }
}

export class CheckConstraintViolation extends DBError {
  constructor() {
    super("ERROR, tried to insert, constraints not met", 3);
    Object.setPrototypeOf(this, CheckConstraintViolation.prototype);
  }
}
