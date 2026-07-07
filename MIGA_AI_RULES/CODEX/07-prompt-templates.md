# MIGA — Prompt Templates for Codex

## 1. Prompt para iniciar trabajo con Codex

```text
You are working on MIGA.

Read the project rules before editing files.

Important constraints:
- MIGA is a mobile-first PWA.
- Do not use gradients.
- Do not add decorative tags/chips/badges.
- Do not add repeated eyebrow labels.
- Do not repeat the product name in every UI section.
- Guest/local-first mode is a priority.
- The timer must use timestamps as the source of truth.
- setInterval may only update the visible UI.
- No AI features in the MVP.
- No mandatory login.
- Do not implement auth before Phase 4.
- Do not implement file upload before Phase 5.

Before editing, inspect the existing files and make the smallest safe change.
```

## 2. Prompt para implementar tarea concreta

```text
Task: [DESCRIBE TASK]

Current phase: [PHASE]

Requirements:
- Inspect existing files first.
- Do not invent file contents.
- Do not rewrite unrelated code.
- Respect the current folder structure.
- Keep the UI mobile-first.
- Follow MIGA design rules.
- Provide complete changed files or a clear diff.
- Include how to run and test.
```

## 3. Prompt para corregir error

```text
Fix this issue in MIGA:

[ERROR]

Rules:
- Find the smallest safe fix.
- Do not refactor unrelated code.
- Explain the root cause.
- Update tests if needed.
- Keep the project compiling.
```

## 4. Prompt para revisión antes de commit

```text
Review the current changes before commit.

Check:
- TypeScript/C# errors;
- broken imports;
- architecture violations;
- security issues;
- mobile-first UI;
- MIGA design rules;
- unnecessary changes;
- missing tests;
- README/docs updates.

Suggest a commit message.
```
