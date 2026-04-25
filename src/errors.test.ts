import { describe, it, expect } from "vitest";
import {
  DBError,
  UniqueConstraintViolation,
  ForeignKeyConstraintViolation,
  CheckConstraintViolation,
} from "./errors";

describe("Error classes", () => {
  it("DBError should have code and _code", () => {
    const err = new DBError("test", 42);
    expect(err.message).toBe("test");
    expect(err.code).toBe(42);
    expect(err._code).toBe(42);
    expect(err).toBeInstanceOf(Error);
  });

  it("UniqueConstraintViolation should have code 1", () => {
    const err = new UniqueConstraintViolation();
    expect(err.message).toBe("ERROR, tried to insert, not unique");
    expect(err.code).toBe(1);
    expect(err._code).toBe(1);
    expect(err.name).toBe("UniqueConstraintViolation");
    expect(err).toBeInstanceOf(UniqueConstraintViolation);
    expect(err).toBeInstanceOf(DBError);
    expect(err).toBeInstanceOf(Error);
  });

  it("UniqueConstraintViolation should accept custom message", () => {
    const err = new UniqueConstraintViolation("custom message");
    expect(err.message).toBe("custom message");
    expect(err.code).toBe(1);
  });

  it("ForeignKeyConstraintViolation should have code 2", () => {
    const err = new ForeignKeyConstraintViolation();
    expect(err.message).toBe("ERROR, tried to remove item that is still a reference");
    expect(err.code).toBe(2);
    expect(err._code).toBe(2);
    expect(err.name).toBe("ForeignKeyConstraintViolation");
    expect(err).toBeInstanceOf(ForeignKeyConstraintViolation);
    expect(err).toBeInstanceOf(DBError);
    expect(err).toBeInstanceOf(Error);
  });

  it("CheckConstraintViolation should have code 3", () => {
    const err = new CheckConstraintViolation();
    expect(err.message).toBe("ERROR, tried to insert, constraints not met");
    expect(err.code).toBe(3);
    expect(err._code).toBe(3);
    expect(err.name).toBe("CheckConstraintViolation");
    expect(err).toBeInstanceOf(CheckConstraintViolation);
    expect(err).toBeInstanceOf(DBError);
    expect(err).toBeInstanceOf(Error);
  });
});
