# CLAUDE.md — MIGA Project Instructions

## Project

The project is **MIGA**.

MIGA is a mobile-first PWA for managing time, goals, sessions, materials, progress, exam simulations and manual review questions.

Brand claim:

```text
Small actions. Big progress.
```

MIGA must not become a generic todo app. The core value is measuring real progress through time sessions and accumulated effort.

## Current strategic decision

MIGA will be built as a **PWA mobile-first**.

Do not plan App Store or Google Play for the MVP.
Do not implement native app tooling unless explicitly requested later.

## Main constraints

- No AI features in the MVP.
- No mandatory login.
- Guest/local-first mode is required.
- Optional account comes later.
- Timer must be reliable and timestamp-based.
- `setInterval` is never the source of truth.
- Security must be designed from the beginning.
- Work phase by phase.
- Do not generate large amounts of files without approval.

## Branding and design

Use MIGA visual identity:

- Apricot: `#FF8A4C`
- Peach: `#FFDCC2`
- Cream: `#FFF7EC`
- Charcoal: `#1F1F1F`
- Pistachio: `#A7CDA3`

Visual style:

- warm;
- clean;
- rounded;
- calm;
- mobile-first;
- human;
- minimal;
- professional.

Do not use:

- gradients;
- decorative tags/chips/badges;
- repeated eyebrow labels;
- repeated product name in every section;
- cold corporate SaaS aesthetics;
- neon colors;
- glassmorphism;
- excessive shadows;
- generic dashboard templates.

Use direct UI labels:

- Inicio;
- Timer;
- Metas;
- Sesiones;
- Estadísticas;
- Ajustes.

Avoid labels like:

- MIGA Dashboard;
- MIGA Goals;
- MIGA Timer;
- MIGA Productivity Hub.

## Technical stack

Frontend:

- React;
- TypeScript;
- Vite;
- PWA;
- Zustand;
- React Hook Form;
- Zod;
- Dexie.js;
- Recharts;
- Vitest;
- Testing Library.

Backend:

- ASP.NET Core;
- PostgreSQL;
- Entity Framework Core;
- REST API;
- Docker;
- xUnit.

## Architecture

Use a monorepo:

```text
/frontend
/backend
/docs
/CLAUDE
/CODEX
```

Frontend should be feature-based.
Backend should be modular monolith / clean architecture light.

## Timer rule

The timer source of truth must be:

- `startedAt`;
- `pausedAt`;
- `resumedAt`;
- `endedAt`;
- `totalPausedSeconds`.

Duration calculation:

```text
durationSeconds = endedAt - startedAt - totalPausedSeconds
```

`setInterval` may only refresh the visible counter.

## Workflow rule

Before modifying code:

1. Inspect the real files involved.
2. Do not invent file contents.
3. Do not rewrite unrelated code.
4. Respect existing structure.
5. Make the smallest safe change.
6. Provide complete final files when requested.

For every module, answer with:

1. Goal.
2. Files created/modified.
3. Commands.
4. Complete code.
5. Explanation.
6. How to test.
7. Common errors.
8. Done checklist.

## Current phase

Start with Phase 1 only:

- repository;
- React + TypeScript + Vite frontend;
- PWA setup;
- ASP.NET Core backend;
- PostgreSQL with Docker;
- docker-compose;
- backend health check;
- basic landing/demo;
- initial README.

Do not implement auth, file upload, AI, payments or native apps in Phase 1.

## Additional files

When more context is needed, read these files:

- `CLAUDE/01-product-context.md`
- `CLAUDE/02-design-rules.md`
- `CLAUDE/03-frontend-rules.md`
- `CLAUDE/04-backend-rules.md`
- `CLAUDE/05-security-rules.md`
- `CLAUDE/06-workflow-rules.md`
- `CLAUDE/07-prompt-templates.md`
