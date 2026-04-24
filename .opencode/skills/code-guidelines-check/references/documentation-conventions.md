# Documentation Conventions

## Core Principle

The reality about documentation is, you have to expect that "They Ain't Gonna Read It".

That does not mean, documentation does not matter. It benefits quickly looking up required information, saving it from forgetting, transferring it to new brains and thus saving it from changes in personell, showing flaws and complexities in the software.

## Guidelines

- **Document do's**, required to get going. This makes it possible for someone to get off and working by themselves.
- **Don't rely on documentation for don'ts**, they should be taken care of:
  1. in code
  2. in person
  3. in documentation
  Preferably, all of them, at least two.
- Add your documentation to the right place (single source of truth). This usually is the README (or additional files, linked to in a wiki-style) in the repository.
- Keep it short.
- Keep it specific.
- Include what is needed.
- Design for search.
- Reduce prose, or a tutorial style. You should be able to jump to the correct location and be able to comprehend that part without reading everything before it.
- Use internal links.

## Architecture Overview

- For large (10k+ lines of code) projects add an ARCHITECTURE.org/.md file next to the README.
- Motivation: it takes 2x more time to write a patch if you are unfamiliar with the project, but it takes 10x more time to figure out where you should change the code.
- New contributor has now mental model of the code, where is what?

### ARCHITECTURE File Contents

- Should describe the high-level architecture.
- Keep it short (will stay valid for longer, every contributor has to read it).
- Only document things that are not likely to change soon.
- Revisit and update it 4 times a year.
- Content:
  - Bird's eye view, coarse-grained modules and their relations.
  - Should answer: Where is the thing that does X.
  - Name important files (prefer searchable names over links as links go stale).
  - Architectural principles (especially, if it is not apparent from the code, e.g. an intentional *lack* of something).
  - Boundaries between layers and systems.
  - Don't describe how the module works (if necessary to document, separate document or inline comments).

## Sources

- [Brown M&Ms, or Why No One's Reading the Manual](https://blog.nuclino.com/brown-m-ms-or-why-no-one-s-reading-the-manual)
- [ARCHITECTURE.md](https://matklad.github.io//2021/02/06/ARCHITECTURE.md.html)
