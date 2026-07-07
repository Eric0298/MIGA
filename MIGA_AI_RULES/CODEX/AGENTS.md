# AGENTS.md — MIGA Project Instructions

## Project

You are working on **MIGA**.

MIGA is a mobile-first PWA for time management, goals, sessions, materials, progress tracking, exam simulations and manual review questions.

Brand claim:

```text
Small actions. Big progress.
```

MIGA is not a generic todo app. It is a progress and time-tracking system based on real sessions and accumulated effort.

## Product decisions

- Build as a PWA first.
- Do not build native apps in the MVP.
- Do not target App Store or Google Play in the MVP.
- No AI features in the MVP.
- No mandatory login.
- Guest/local-first mode is required.
- Optional account and sync come later.

## Design constraints

Use the MIGA brand colors:

- Apricot: `#FF8A4C`
- Peach: `#FFDCC2`
- Cream: `#FFF7EC`
- Charcoal: `#1F1F1F`
- Pistachio: `#A7CDA3`

The UI must be:

- mobile-first;
- warm;
- rounded;
- calm;
- clean;
- focused;
- accessible;
- human.

Do not use:

- gradients;
- decorative tags/chips/badges;
- repeated eyebrow labels;
- repeated “MIGA” naming inside every screen;
- neon colors;
- glassmorphism;
- generic SaaS dashboard visuals;
- excessive shadows;
- complex animations.

Use natural labels:

- Inicio;
- Timer;
- Metas;
- Sesiones;
- Estadísticas;
- Ajustes.

Avoid labels like:

- MIGA Dashboard;
- MIGA Goals;
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

Never use `setInterval` as the source of truth for the timer.

The timer source of truth must be timestamps:

- `startedAt`;
- `pausedAt`;
- `resumedAt`;
- `endedAt`;
- `totalPausedSeconds`.

`setInterval` can only update the visible UI.

## Editing rules

Before editing:

1. Inspect the actual files.
2. Do not invent file contents.
3. Do not rewrite unrelated code.
4. Keep the existing architecture.
5. Make the smallest safe change.
6. Keep the project compiling.
7. Add/update tests when appropriate.
8. Respect MIGA design rules.

## Current phase

Work on Phase 1 only unless explicitly instructed otherwise:

- repository;
- React + TypeScript + Vite frontend;
- PWA setup;
- ASP.NET Core backend;
- PostgreSQL with Docker;
- docker-compose;
- backend health check;
- basic landing/demo;
- initial README.

Do not implement auth, file upload, AI, payments, sync or native app tooling in Phase 1.

## Supporting docs

Read when needed:

- `CODEX/01-product-context.md`
- `CODEX/02-design-rules.md`
- `CODEX/03-frontend-rules.md`
- `CODEX/04-backend-rules.md`
- `CODEX/05-security-rules.md`
- `CODEX/06-workflow-rules.md`
- `CODEX/07-prompt-templates.md`
