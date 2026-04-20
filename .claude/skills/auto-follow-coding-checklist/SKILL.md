---
name: auto-follow-coding-checklist
description: Reads TASKS.md from the current repository, picks the first open task, breaks it into well-scoped subtasks (following TDD and frequent-commit discipline), updates TASKS.md with those subtasks, then creates task-tool entries to execute each one. Use this skill whenever the user says "work on TASKS.md", "pick up the next task", "continue from the checklist", "do the next item", or wants Claude to autonomously drive development from a markdown task list.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, TaskCreate, TaskUpdate, TaskList
context: fork
agent: general-purpose
disable-model-invocation: true
---

Your job is to read the project's `TASKS.md`, pick the next open item, plan it carefully, update the file, and then create a sequence of focused Task-tool tasks so the work gets done incrementally with regular commits.

## Step 1 — Read TASKS.md

Read the file `TASKS.md` at the root of the current working directory.

Parse the checklist. Items look like:

```
- [ ] Some task        ← open (to do)
- [x] Some task        ← closed (done)
  - [ ] subtask        ← indented subtask
```

Find the **first open top-level item** (a `- [ ]` line that is not indented as a subtask of something else). This is the task you will work on. If all tasks are closed, tell the user and stop.

Also look for any branch instructions at the top of the file, such as:

```
<!-- branch: feature/my-branch -->
```

or prose like "all work should happen on `feature/xyz`" or "task 3 must be on branch `fix/foo`". Note any branch requirement for the chosen task.

## Step 2 — Decide whether to break the task into subtasks

A task needs subtasks when it involves multiple logical phases (e.g., set up data model, write API, write tests, deploy). A task is fine as-is when it is already atomic (e.g., "rename variable X to Y in file Z").

When breaking into subtasks, keep each subtask small enough that it can be done and committed in a single focused session. Claude may run out of tokens at any moment, so frequent commits protect work. A good subtask does one thing: writes a module, adds a test suite, updates a config, etc.

**TDD rule**: if the task involves writing new logic or functions, the subtasks must include:
1. Write stub(s) + failing tests first, commit.
2. Implement to make tests pass, commit.
3. (Optionally) refactor, commit.

Never write implementation code before the tests exist.

**TASKS.md update rule**: every "commit & push" subtask must include updating `TASKS.md` to mark that subtask complete before the commit. This keeps the file in sync with history.

## Step 3 — Update TASKS.md

Write the subtasks back into `TASKS.md` as indented items under the main task:

```markdown
- [ ] Build user authentication
  - [ ] Write auth stubs and failing tests, commit
  - [ ] Implement auth logic to pass tests, commit & push
  - [ ] Add integration tests for edge cases, commit & push
```

If the task already has subtasks listed, use them as-is (don't regenerate). Only generate subtasks for tasks that have none.

Save the file.

## Step 4 — Build the Task-tool sequence

Now use the TaskCreate tool to create an ordered queue of tasks for yourself. This is the execution plan. Create them all up front so progress is visible.

The sequence should follow this pattern:

```
[optional] Checkout / create branch
[for each subtask]
  → Do the subtask work
  → Update TASKS.md to mark subtask done, then commit & push
```

### Branch task (only if needed)

If TASKS.md specifies a branch for this task (or globally), add a first task:

> **subject**: Checkout branch `<branch-name>`
> **description**: Run `git checkout <branch-name>` or `git checkout -b <branch-name>` if it doesn't exist yet. Confirm the branch is active before proceeding.

### Subtask work tasks

For each subtask, create two consecutive tasks:

**Task A — Do the work:**
- subject: `<subtask description>`
- description: Detailed instructions for what to implement, create, or change. Reference relevant files if known. If this is a TDD stub/test task, be explicit: write the function signatures with `pass`/`raise NotImplementedError` bodies (or equivalent), then write tests that call them and assert expected behaviour. Do NOT implement the real logic yet.

**Task B — Update TASKS.md + commit & push:**
- subject: `Mark subtask done in TASKS.md, commit & push`
- description: |
    1. Open TASKS.md and change the subtask `- [ ] <subtask>` to `- [x] <subtask>`.
    2. Stage all changed files with `git add`.
    3. Commit with a clear message referencing the subtask.
    4. Push to the remote.

  Make Task B depend on (blocked by) Task A.

### Closing task

After all subtasks are done, add one final task:

> **subject**: Mark main task complete in TASKS.md, commit & push
> **description**: Change `- [ ] <main task>` to `- [x] <main task>` in TASKS.md. Commit and push.

This task is blocked by the last subtask's commit task.

## Step 5 — Start working

After all Task-tool tasks are created, pick up Task 1 and start executing. Work through each task in order, marking each complete when done before moving to the next.

---

## Checklist hygiene

- Keep TASKS.md as the single source of truth. Every change to what's done or not done must be reflected there before the associated commit.
- Commit messages should be clear and scoped: `feat: implement user login stub and tests` rather than `updates`.
- If a subtask turns out to be more complex than expected, it's fine to split it further — just update TASKS.md first, then add new Task-tool tasks.
- Never mark a task complete if tests are failing.
