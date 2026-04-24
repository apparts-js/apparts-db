# Coding Conventions

> Most formatting and style rules are already enforced by **Prettier** and **ESLint** (or the TypeScript compiler). Use of these tools is mandatory. The conventions below focus on what the tooling *cannot* enforce: clarity, structure, and human judgment.

## General Principles

- Do *not* try to be fancy or clever: Keep it simple and easy to read.
  > Debugging is twice as hard as writing the code in the first place. Therefore, if you write the code as cleverly as possible, you are, by definition, not smart enough to debug it.
  > -- Brian Kernighan

- Code duplication should be avoided. If you deem it necessary in certain cases, leave a statement to the reviewer and future readers, why you deem it necessary.
- Try to keep together what belongs together, group code by conceptional units.

## Naming

- Names are clear and descriptive (exceptions for iterators can be made, if not overused).
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
const myConstantFunc = () => 7
const mySlightlyMoreComplexFunc = (a, _, b) => {
  return a + b;
};
```

- If a parameter is not used you can use `_` to indicate this.

## Sources

- [W3Schools JavaScript conventions](https://www.w3schools.com/js/js_conventions.asp)
