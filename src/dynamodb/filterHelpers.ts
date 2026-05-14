import { Params } from "../generic";

const PK = "id";

export const namePlaceholder = (
  attr: string,
  attrNames: Record<string, string>
): string => {
  const key = `#n${Object.keys(attrNames).length}`;
  attrNames[key] = attr;
  return key;
};

export const valuePlaceholder = (
  value: unknown,
  attrValues: Record<string, unknown>
): string => {
  const key = `:v${Object.keys(attrValues).length}`;
  attrValues[key] = value;
  return key;
};

export const isSinglePrimaryKeyLookup = (
  params: Params
): { hit: boolean; key?: string | number } => {
  const keys = Object.keys(params);
  if (keys.length !== 1 || keys[0] !== PK) {
    return { hit: false };
  }
  const v = params[PK];
  if (v === null) {
    return { hit: false };
  }
  if (typeof v === "object") {
    return { hit: false };
  }
  return { hit: true, key: v as string | number };
};

// Shared by Query.update and TransactionQuery.update — both build the same
// UpdateItem input shape, they just differ in whether they send it now or
// buffer it for a transactional commit. Returns null when the change set is
// empty (callers treat that as "rowCount: 0, no SDK call").
export const buildUpdateInput = (
  table: string,
  pkValue: string | number,
  c: Record<string, unknown>
): {
  TableName: string;
  Key: Record<string, string | number>;
  UpdateExpression: string;
  ConditionExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
} | null => {
  const setKeys = Object.keys(c);
  if (setKeys.length === 0) {
    return null;
  }

  const attrNames: Record<string, string> = { "#pk": PK };
  const attrValues: Record<string, unknown> = {};
  const assignments = setKeys.map((k) => {
    const n = namePlaceholder(k, attrNames);
    const v = valuePlaceholder(c[k], attrValues);
    return `${n} = ${v}`;
  });

  return {
    TableName: table,
    Key: { [PK]: pkValue },
    UpdateExpression: "SET " + assignments.join(", "),
    // Without this, UpdateItem would upsert. Match the Postgres
    // UPDATE ... WHERE id = ... semantics: missing row -> rowCount 0
    // (or, in a transaction, fails the whole tx).
    ConditionExpression: "attribute_exists(#pk)",
    ExpressionAttributeNames: attrNames,
    ExpressionAttributeValues: attrValues,
  };
};
