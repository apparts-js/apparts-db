import { NotSupportedByDBEngine, Params } from "../generic";
import { buildFilterExpression } from "./Query";

// A few operators used in this codebase (notin, unknown) are not part of the
// generic `Filter` union, so tests exercising them cast through `unknown`.
const p = (v: unknown): Params => v as Params;

describe("buildFilterExpression", () => {
  test("empty params → kind=empty", () => {
    expect(buildFilterExpression({})).toEqual({ kind: "empty" });
  });

  test("single attribute equality", () => {
    const r = buildFilterExpression({ foo: "x" });
    expect(r.kind).toBe("expr");
    if (r.kind !== "expr") return;
    expect(r.expr).toBe("#n0 = :v0");
    expect(r.attrNames).toEqual({ "#n0": "foo" });
    expect(r.attrValues).toEqual({ ":v0": "x" });
  });

  test("null shorthand renders (attribute_not_exists OR = null) to match absent and NULL-typed attributes", () => {
    const r = buildFilterExpression(p({ foo: null }));
    expect(r.kind).toBe("expr");
    if (r.kind !== "expr") return;
    expect(r.expr).toBe("(attribute_not_exists(#n0) OR #n0 = :v0)");
    expect(r.attrNames).toEqual({ "#n0": "foo" });
    expect(r.attrValues).toEqual({ ":v0": null });
  });

  test("bare array on non-PK renders IN with placeholders", () => {
    const r = buildFilterExpression({ tag: ["a", "b"] });
    expect(r.kind).toBe("expr");
    if (r.kind !== "expr") return;
    expect(r.expr).toBe("#n0 IN (:v0, :v1)");
    expect(r.attrValues).toEqual({ ":v0": "a", ":v1": "b" });
  });

  test("bare empty array → always_false, no invalid '1 = 0' emitted", () => {
    const r = buildFilterExpression(p({ tag: [] }));
    expect(r).toEqual({ kind: "always_false" });
  });

  test("{op:'in',val:[]} at non-PK → always_false, no invalid '1 = 0'", () => {
    const r = buildFilterExpression({ tag: { op: "in", val: [] } });
    expect(r).toEqual({ kind: "always_false" });
  });

  test("{op:'in',val:[...]} non-empty renders IN with placeholders", () => {
    const r = buildFilterExpression({ tag: { op: "in", val: ["a", "b"] } });
    expect(r.kind).toBe("expr");
    if (r.kind !== "expr") return;
    expect(r.expr).toBe("#n0 IN (:v0, :v1)");
    expect(r.attrNames).toEqual({ "#n0": "tag" });
    expect(r.attrValues).toEqual({ ":v0": "a", ":v1": "b" });
  });

  test("{op:'notin',val:[]} → drops clause (always_true), other clauses remain", () => {
    const r = buildFilterExpression(
      p({
        tag: { op: "notin", val: [] },
        foo: "x",
      })
    );
    expect(r.kind).toBe("expr");
    if (r.kind !== "expr") return;
    expect(r.expr).toBe("#n0 = :v0");
    expect(r.attrNames).toEqual({ "#n0": "foo" });
  });

  test("{op:'notin',val:[]} as the only clause → kind=empty (scan all)", () => {
    const r = buildFilterExpression(p({ tag: { op: "notin", val: [] } }));
    expect(r).toEqual({ kind: "empty" });
  });

  test("composite: one always_false short-circuits the whole AND", () => {
    const r = buildFilterExpression({
      foo: "x",
      tag: { op: "in", val: [] },
    });
    expect(r).toEqual({ kind: "always_false" });
  });

  test("comparison operators: lt, lte, gt, gte", () => {
    const cases: ["lt" | "lte" | "gt" | "gte", string][] = [
      ["lt", "<"],
      ["lte", "<="],
      ["gt", ">"],
      ["gte", ">="],
    ];
    for (const [op, sym] of cases) {
      const r = buildFilterExpression({ age: { op, val: 5 } });
      expect(r.kind).toBe("expr");
      if (r.kind !== "expr") continue;
      expect(r.expr).toBe(`#n0 ${sym} :v0`);
      expect(r.attrValues).toEqual({ ":v0": 5 });
    }
  });

  test("exists operator renders attribute_exists / attribute_not_exists", () => {
    const rTrue = buildFilterExpression({ foo: { op: "exists", val: true } });
    expect(rTrue.kind).toBe("expr");
    if (rTrue.kind === "expr") {
      expect(rTrue.expr).toBe("attribute_exists(#n0)");
      expect(rTrue.attrValues).toEqual({});
    }
    const rFalse = buildFilterExpression({
      foo: { op: "exists", val: false },
    });
    expect(rFalse.kind).toBe("expr");
    if (rFalse.kind === "expr") {
      expect(rFalse.expr).toBe("attribute_not_exists(#n0)");
      expect(rFalse.attrValues).toEqual({});
    }
  });

  test("notin non-empty renders NOT (... IN ...)", () => {
    const r = buildFilterExpression(
      p({ tag: { op: "notin", val: ["a", "b"] } })
    );
    expect(r.kind).toBe("expr");
    if (r.kind !== "expr") return;
    expect(r.expr).toBe("NOT (#n0 IN (:v0, :v1))");
  });

  test("and operator combines sub-operators", () => {
    const r = buildFilterExpression({
      age: {
        op: "and",
        val: [
          { op: "gt", val: 1 },
          { op: "lte", val: 10 },
        ],
      },
    });
    expect(r.kind).toBe("expr");
    if (r.kind !== "expr") return;
    expect(r.expr).toBe("(#n0 > :v0 AND #n1 <= :v1)");
    expect(r.attrValues).toEqual({ ":v0": 1, ":v1": 10 });
  });

  test("and operator: always_false sub-clause short-circuits the AND", () => {
    const r = buildFilterExpression({
      age: {
        op: "and",
        val: [
          { op: "in", val: [] },
          { op: "gt", val: 1 },
        ],
      },
    });
    expect(r).toEqual({ kind: "always_false" });
  });

  test("and operator: always_true sub-clauses are dropped; remaining clause stands", () => {
    const r = buildFilterExpression(
      p({
        age: {
          op: "and",
          val: [
            { op: "notin", val: [] },
            { op: "gt", val: 1 },
          ],
        },
      })
    );
    expect(r.kind).toBe("expr");
    if (r.kind !== "expr") return;
    expect(r.expr).toBe("(#n0 > :v0)");
  });

  test("like / ilike / oftype / of throw NotSupportedByDBEngine", () => {
    expect(() =>
      buildFilterExpression({ foo: { op: "like", val: "%" } })
    ).toThrow(NotSupportedByDBEngine);
    expect(() =>
      buildFilterExpression({ foo: { op: "ilike", val: "%" } })
    ).toThrow(NotSupportedByDBEngine);
    expect(() =>
      buildFilterExpression({
        foo: { op: "oftype", val: { path: ["x"], value: "string" } },
      })
    ).toThrow(NotSupportedByDBEngine);
    expect(() =>
      buildFilterExpression({
        foo: { op: "of", val: { path: ["x"], value: "y" } },
      })
    ).toThrow(NotSupportedByDBEngine);
  });

  test("unknown operator throws NotSupportedByDBEngine", () => {
    expect(() =>
      buildFilterExpression(p({ foo: { op: "something", val: 1 } }))
    ).toThrow(NotSupportedByDBEngine);
  });
});
