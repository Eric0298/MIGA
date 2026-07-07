# MIGA

Small actions. Big progress.

Miga es una PWA mobile-first para gestionar tiempo, metas, sesiones y progreso real.
Modo invitado local, sin login obligatorio, sin IA en el MVP.

## Estructura

```
frontend/          React + TypeScript + Vite + Tailwind + PWA
backend/           ASP.NET Core (.NET 10) + PostgreSQL + EF Core
MIGA_AI_RULES/     Reglas de producto, diseño y workflow
docker-compose.yml PostgreSQL de desarrollo
```

## Requisitos

- Node.js 20+
- .NET SDK 10
- Docker Desktop

## Quickstart

```bash
# 1. Base de datos (PostgreSQL 17)
docker compose up -d

# 2. Backend (en otra terminal)
cd backend
dotnet run --project src/Miga.Api

# 3. Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: el puerto se muestra en la consola al arrancar

## Health checks

- `GET /api/health` → estado del servicio.
- `GET /api/health/db` → conectividad con PostgreSQL.

## Scripts útiles

Desde la raíz:

```bash
npm run format         # formatear todo el repo con Prettier
npm run format:check   # verificar formato sin escribir
npm run dev:db         # levantar PostgreSQL con Docker
npm run dev:db:down    # detener PostgreSQL
npm run dev:frontend   # arrancar Vite
```

En `frontend/`:

```bash
npm run dev            # servidor Vite
npm run build          # typecheck + build de producción
npm run preview        # servir la build
npm run test           # Vitest single run
npm run test:watch     # Vitest en watch
npm run typecheck      # solo verificación TypeScript
npm run lint           # ESLint
npm run format         # Prettier sobre frontend/
```

## Fases

- Fase 1 (cerrada) — repositorio, PWA base, health checks, landing y shell mobile-first.
- Fase 2 (siguiente) — Dexie + modo invitado local + primer feature (metas o timer).

Ver `MIGA_AI_RULES/CLAUDE/` para reglas de producto, diseño y workflow.
