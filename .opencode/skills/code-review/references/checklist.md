# Code Review Checklist for @apparts/db

Apply these checks to every review. They're derived from recurring patterns and past issues in this codebase.

## SQL safety

- **Key injection via `_checkKey`**: Any code path that uses a field name in a query must pass it through `_checkKey()` first. This method rejects keys containing quotes, which is the primary defense against SQL injection through column names. If new code constructs SQL strings using user-supplied field names without calling `_checkKey`, flag it as a must-fix.
- **Parameterized values**: Values (not keys) must always go through PostgreSQL's `$N` parameter binding, never interpolated directly into the SQL string. Verify new operators and methods follow the same `$1`, `$2` pattern as the rest of `Query.ts`.

## Operator dispatch consistency

When a new filter operator is added to the dispatch in `Query.ts`:
- It must handle both the happy path and invalid/missing input (what happens if `val` is undefined, or `path` is empty?)
- It must be covered by a test in `Query.test.ts` — both a matching case and a non-matching case
- The SQL it generates should be verified against what PostgreSQL actually accepts, not just assumed to be correct
- If the operator accepts a sub-operator (like `of` does), check that sub-operator validation is consistent with how other sub-operators are validated

## Error logging

This codebase has explicit error logging in every method that touches the database. When adding a new method or wrapping an existing one:
- The `_log()` call must include the method name as the first argument (e.g., `"Error in myMethod:"`)
- The query string and params must be passed correctly — `null` for params when there are none, the actual params array otherwise
- The method must re-throw after logging — errors must propagate to callers
- The corresponding mock test in `DBS.test.ts` must assert on the exact SQL string. Derive the expected SQL from the real integration test output, not by guessing.

## Return types

- `insert()` returns the inserted rows with their generated `id` — new insert-like methods should follow this
- `find()`-family methods return arrays via `toArray()` — they should not return raw pg result objects
- Promises must be returned (not forgotten) — async methods that don't `await` internally and don't return the Promise will silently swallow errors

## Configuration awareness

Several behaviours change based on `this._config`:
- `arrayAsJSON` affects how array columns are read and written — any code touching array fields must handle both cases
- `idsAsBigInt` affects type conversion in `convertType()` — changes to ID handling must account for this flag
- `logs` and `logParams` affect what gets logged — don't add unconditional `console.log` calls; route everything through `_log()`

## TypeScript types

- New method parameters should be typed, not `any` — look at how similar parameters are typed elsewhere in the file
- Return types should be explicit on public methods
- Casting to `any` to bypass type checking is a yellow flag; understand why the type doesn't fit before accepting the cast

## Test hygiene

When reviewing test additions alongside code changes, apply the patterns from `verify-tests` gotchas:
- `await` before every `.rejects`/`.resolves` assertion
- `toStrictEqual` when the complete return shape is being asserted
- New tests should insert their own data rather than relying on rows from earlier tests in the same describe block
- Mock tests that assert on a SQL string must have that string verified against a real integration test run
