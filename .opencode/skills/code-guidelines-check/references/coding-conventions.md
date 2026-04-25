# Coding Conventions

> Most formatting and style rules are already enforced by **Prettier** and **ESLint** (or the TypeScript compiler). Use of these tools is mandatory. The conventions below focus on what the tooling _cannot_ enforce: clarity, structure, and human judgment.

## General Principles

- Do _not_ try to be fancy or clever: Keep it simple and easy to read.

  > Debugging is twice as hard as writing the code in the first place. Therefore, if you write the code as cleverly as possible, you are, by definition, not smart enough to debug it.
  > -- Brian Kernighan

- Code duplication should be avoided. If you deem it necessary in certain cases, leave a statement to the reviewer and future readers, why you deem it necessary.
- Try to keep together what belongs together, group code by conceptional units.

## Naming

- Names are clear and descriptive (exceptions for iterators can be made, if not overused). Except for iterators: no single character names
  - Good: const isReady = true;
  - Bad: const r = true;
- Reduce global variables as far as possible.

## If-Statements

- Try to keep together what belongs together:

```js
// DONT DO:
if (mySpecialCondition) {
  // Super long and deeply nested stuff.
} else {
  // Error handling for my special condition failing...
  // By here I totally don't know anymore what condition got me here.
}

// DO
if (!mySpecialCondition) {
  // Error handling for my special condition failing...
  // Use return or throw to abort rest of logic beeing executed.
  // All stuff related to my special condition is contained in
  // one section of code and not split over 10s of lines.
}

// Rest of logic downstream
```

## JavaScript Specific

### Functions

- Use functional definitions.

```js
const myConstantFunc = () => 7;
const mySlightlyMoreComplexFunc = (a, _, b) => {
  return a + b;
};
```

- If a parameter is not used you can use `_` to indicate this.

## Tests

- Use `describe` blocks to group related tests into logical, named sections. This mirrors the structure of the code under test and makes it easy to locate relevant test cases.
- Nest `describe` blocks to reflect hierarchies (e.g., module → function → scenario).
- Name `it`/`test` blocks with full, descriptive sentences that state the expected behavior.
- Keep setup, execution, and assertion visually close within each test. Extract shared setup into `beforeEach`/`beforeAll` only when it genuinely reduces repetition without hiding important context.

```js
// DON'T DO: Flat, unstructured tests
test('login works', () => { ... });
test('login fails with wrong password', () => { ... });
test('logout works', () => { ... });

// DO: Segment into logical blocks with describe
describe('Authentication', () => {
  describe('login', () => {
    it('should succeed with valid credentials', () => { ... });
    it('should fail with an invalid password', () => { ... });
  });

  describe('logout', () => {
    it('should clear the active session', () => { ... });
  });
});
```

## Doc Comments

- Do not add doc comments for self-explanatory code. If the purpose of a function, parameter, or return value is already obvious from its name and type, skip the comment.
- Add a doc comment (e.g. JSDoc) when there is extra context the caller must know: preconditions, side effects, performance characteristics, non-obvious edge cases, or architectural rationale.
- Keep doc comments concise. Transport the _additional_ information; do not restate what the code already says.

```js
// DON'T DO: Restates the obvious
/**
 * Returns the sum of a and b.
 * @param a - The first number.
 * @param b - The second number.
 * @returns The sum.
 */
const add = (a, b) => a + b;

// DO: Adds only the non-obvious context
/**
 * Returns the sum, capping at Number.MAX_SAFE_INTEGER
 * instead of overflowing silently.
 */
const safeAdd = (a, b) => Math.min(a + b, Number.MAX_SAFE_INTEGER);
```

## Error Messages

- Error messages should be actionable: tell the user _what went wrong_ and, when possible, _how to fix it_.
- Phrase messages in plain language. Avoid internal jargon, stack-trace noise, or cryptic codes unless they are surfaced to an operator who explicitly needs them.
- Include relevant identifiers (file names, IDs, configuration keys) so the message is useful in logs and support tickets.

```js
// DON'T DO: Vague and unhelpful
throw new Error("Failed");

// DO: Actionable and specific
throw new Error(
  `Upload failed for "${fileName}": file exceeds the maximum size of ${MAX_SIZE_MB} MB. ` +
    `Please compress the image or reduce its dimensions.`
);
```

## Sources

- [W3Schools JavaScript conventions](https://www.w3schools.com/js/js_conventions.asp)
