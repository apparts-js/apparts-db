# Test Correctness Patterns to Watch For

Patterns that make tests *look* correct but silently miss bugs. Scan for all of these on every audit — they recur whenever new tests are added.

## 1. Missing `await` on async assertions
`expect(asyncFn).rejects` without `await` is a no-op — the assertion never runs and the test always passes. Grep for `.rejects` (and `.resolves`) and confirm every occurrence has `await` in front.

```typescript
// wrong — always passes
expect(async () => { await call(); }).rejects.toThrow("msg");

// correct
await expect(call()).rejects.toThrow("msg");
```

## 2. `toMatchObject` masking extra fields
`toMatchObject` ignores unexpected extra keys — a query leaking extra columns will pass. Use `toStrictEqual` when asserting the *complete* return shape; reserve `toMatchObject` for checking a subset of fields only.

## 3. Mock tests with hardcoded SQL strings
When a test mocks the db client, the SQL string in the assertion is the only thing checking query generation. If the query builder is refactored without updating the assertion, both can drift silently. Always confirm expected SQL by running the real integration test first — don't guess the string.

## 4. Order-dependent tests sharing database state
The suite uses `beforeAll`/`afterAll`, so tests in a block share database state. A test relying on rows inserted by a prior test will break if tests are reordered or a new one is inserted between them. Each test should set up its own data, or use an explicit `beforeAll` for shared rows.

## 5. Missing operator/case parity
When a new operator or switch case is added to the source, it's easy to test only the happy path. For every `case`/`op` in the dispatch, verify there's at least one test — including the error path if the operator can receive invalid input.

## 6. Integration vs. mock suite mismatch
Integration tests (`setupDbs`/`teardownDbs`) silently hang if PostgreSQL isn't running. Mock tests lose fidelity if used where real SQL behavior matters. Keep them separate: SQL behavior and return values → integration suite; logging, error handling, config flags → mock suite.
