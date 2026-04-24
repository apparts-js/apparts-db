# Coverage Checklist: @apparts/db

Use this as a checklist when auditing. For each item, read the current source to confirm whether it's covered — don't assume the state listed here is still accurate.

## Query.ts — Filter Operators

Every operator handled in the filter dispatch should have tests covering:

- Basic happy path (filter matches rows, filter matches nothing)
- Edge input for the value type (empty string, zero, empty array where applicable)
- Combined with ordering and pagination (doesn't need exhaustive combinations, just one sanity check)

Operators to verify coverage for:

- Equality (default, no `op` key)
- `in` — array of values
- `notin` — array of values
- `gt`, `lt`, `gte`, `lte` — numeric comparisons
- `like`, `ilike` — string pattern matching
- `exists` — null/not-null check
- `any` — array contains value
- `of` — JSON path value check (one level, multiple levels, with sub-operator, with `cast`)
- `oftype` — JSON path type check
- `and` — combine multiple conditions on one field

For each operator, also check: is there a test for the _error case_ when an invalid value is passed?

## Query.ts — Core Methods

Each method should have:

- At least one happy-path integration test
- A test for the empty-result case (no rows match)
- A test for the error/rejection path (can be mock-based)

Methods to check:

- `find()` with filters, ordering, limit, offset
- `findById()` with single value and array (`in` operator)
- `findByIds()`
- `insert()` — single row, multiple rows; verify returned IDs
- `updateOne()` — matches one row; what happens when zero rows match?
- `update()` — matches multiple rows
- `remove()` — with filter; what happens with empty filter?
- `drop()` — drops the table
- `count()` — with and without filter

## DBS.ts — Top-Level Methods

- `collection()` — returns a Query instance (covered implicitly everywhere, but check it exists)
- `transaction()` — commit path, rollback path (error thrown inside callback)
- `raw()` — executes arbitrary SQL; verify result is passed through
- `createCollection()` — builds a `CREATE TABLE` statement; verify each feature:
  - Basic field with type
  - `notNull` constraint
  - `default` value
  - Primary key index (`key` array)
  - Unique constraint (`unique: true`)
  - Foreign key reference (`foreign: { table, field }`)
  - `prefix` parameter (prepends to constraint names)
- `convertType()` — maps abstract type names to PostgreSQL types; verify each supported type:
  - `"int"` → `"integer"`
  - `"id"` — with and without `auto` flag, with and without `idsAsBigInt` config
  - `"text"` — with and without `maxLength`
  - `"email"`, `"bool"`, `"float"`, `"time"`, `"array"`, `"/"`
  - Unknown type (what should happen?)

## Error Logging

The mock-based logging suite should cover each operation that has logging:

- Each method (`find`, `insert`, `updateOne`, `update`, `remove`, `drop`, `raw`)
- `logs: "errors"` config with `logParams: true` (params included in log)
- `logs: "errors"` config with `logParams: false` (params omitted)
- `logs: "queries"` config (logs successful queries too)

## Transaction Behavior

- Successful transaction returns callback's return value
- Error thrown inside callback triggers rollback and re-throws
- `end()` is called exactly once in both cases

## Configuration Options

- `arrayAsJSON: true` — arrays stored/retrieved as JSON, not native arrays
- `arrayAsJSON: false` — native PostgreSQL arrays
- `idsAsBigInt` — affects `convertType("id")` output
- `logs` + `logParams` — covered under Error Logging above

## PostgreSQL Error Code Handling

The library surfaces pg error codes to callers. Verify that tests exist for:

- `23505` — unique constraint violation (insert duplicate)
- `23503` — foreign key violation
- `23514` — check constraint violation

These confirm the errors propagate correctly rather than being swallowed.
