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
  if (keys.length !== 1 || keys[0] !== PK) return { hit: false };
  const v = params[PK];
  if (v === null) return { hit: false };
  if (typeof v === "object") return { hit: false };
  return { hit: true, key: v as string | number };
};
