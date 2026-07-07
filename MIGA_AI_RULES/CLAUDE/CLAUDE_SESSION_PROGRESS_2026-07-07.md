# MIGA — Session Progress Context for Claude

Date: 2026-07-07  
Project: **MIGA**  
Type: **mobile-first PWA** for time management, goals, sessions, materials, progress tracking and personal productivity.  
Primary user/developer: Eric, junior fullstack developer building a serious portfolio project.

---

## 1. Purpose of this file

This file gives Claude the full context of what has already been decided and implemented during the initial MIGA setup session.

Claude must use this file together with the existing MIGA rules already present in the repository.

Main instruction:

> Do not restart the project from scratch. Continue from the current state, inspect real files before proposing changes, and work phase by phase.

---

## 2. Product decisions confirmed

### Product name

The project is now called:

```text
MIGA
```

The provisional name `TimePath` is no longer used.

### Product type

MIGA will be built first as a:

```text
mobile-first PWA
```

It will **not** be published initially to App Store or Google Play because those stores require developer account costs.

### Store strategy

| Platform | Current decision |
|---|---|
| App Store | Out of MVP |
| Google Play | Out of MVP |
| PWA installability | Required |
| Cost target | 0 € initial cost |

MIGA should be installable from the browser as a PWA and should feel like a mobile app.

---

## 3. Branding and design context

The user provided a brand board image for MIGA.

### Brand elements

| Element | Value |
|---|---|
| Name | Miga / MIGA |
| Claim | Small actions. Big progress. |
| Main feeling | warm, clean, rounded, calm, mobile-first |
| Personality | small accumulated actions, steady progress, human productivity |

### Colors

| Color | Hex | Intended use |
|---|---:|---|
| Apricot | `#FF8A4C` | primary actions, brand icon, emphasis |
| Peach | `#FFDCC2` | soft surfaces, secondary cards |
| Cream | `#FFF7EC` | main background |
| Charcoal | `#1F1F1F` | text, contrast, logo |
| Pistachio | `#A7CDA3` | positive state, progress, success |

### Typography

Use a rounded friendly typeface. Current installed fallback:

```text
@fontsource-variable/nunito
```

### Strict design restrictions

Do not use:

- gradients;
- decorative tags/chips/badges;
- repeated eyebrow labels;
- repeated nomenclature like `MIGA Dashboard`, `MIGA Goals`, `MIGA Sessions`;
- cold generic corporate SaaS styling;
- glassmorphism;
- neon palettes;
- excessive shadows;
- fake motivational/productivity jargon.

Prefer:

- direct headings;
- calm spacing;
- rounded cards;
- warm solid colors;
- readable contrast;
- mobile-first layouts;
- minimal, meaningful icons;
- useful empty states.

---

## 4. AI rules folder context

A previous package of AI rules was generated and committed under:

```text
MIGA_AI_RULES/
├── CLAUDE/
└── CODEX/
```

The user originally mentioned creating folders named:

```text
CLAUDE/
CODEX/
```

But the committed structure currently appears as:

```text
MIGA_AI_RULES/CLAUDE/...
MIGA_AI_RULES/CODEX/...
```

Do not move these automatically unless the user asks. If restructuring, do it in a dedicated commit.

---

## 5. Frontend status

### Frontend created

The frontend was created with Vite:

```powershell
npm create vite@latest frontend -- --template react-ts
```

Vite asked which linter to use, and the user selected:

```text
ESLint
```

### Root npm packages installed

At repository root:

```powershell
npm init -y
npm install -D concurrently prettier
```

### Frontend dependencies installed

Runtime dependencies installed in `frontend`:

```text
react-router
zustand
react-hook-form
zod
@hookform/resolvers
dexie
recharts
date-fns
clsx
lucide-react
sonner
vaul
@tanstack/react-query
lenis
lottie-react
@fontsource-variable/nunito
tailwindcss
@tailwindcss/vite
```

Development dependencies installed in `frontend`:

```text
vite-plugin-pwa
vitest
jsdom
@testing-library/react
@testing-library/jest-dom
@testing-library/user-event
vite-tsconfig-paths
```

### ESLint accessibility plugin decision

The install of `eslint-plugin-jsx-a11y` failed because the Vite template installed ESLint 10, while the plugin did not yet declare support for ESLint 10.

Decision:

```text
Do not force install eslint-plugin-jsx-a11y.
Do not use --force or --legacy-peer-deps.
Use semantic HTML and manual accessibility checks for now.
Revisit later when compatible or if intentionally downgrading ESLint.
```

### Frontend not yet cleaned

The Vite starter files still likely exist:

```text
frontend/src/App.tsx
frontend/src/App.css
frontend/src/index.css
frontend/src/assets/react.svg
frontend/src/assets/vite.svg
frontend/src/assets/hero.png
```

Next frontend phase should inspect these real files before replacing them.

---

## 6. Backend status

### .NET SDK installed

The user installed .NET SDK successfully:

```text
10.0.301 [C:\Program Files\dotnet\sdk]
```

Backend uses:

```text
.NET 10 + ASP.NET Core + PostgreSQL + EF Core
```

### Backend solution structure created

Current backend structure:

```text
backend/
├── Miga.slnx
├── src/
│   ├── Miga.Api/
│   ├── Miga.Application/
│   ├── Miga.Contracts/
│   ├── Miga.Domain/
│   └── Miga.Infrastructure/
└── tests/
    ├── Miga.IntegrationTests/
    └── Miga.UnitTests/
```

Note: the committed solution file is `Miga.slnx`, not `Miga.sln`.

### Backend packages installed

API:

```text
Microsoft.AspNetCore.OpenApi 10.0.9
Microsoft.OpenApi 2.7.5
Serilog.AspNetCore 10.0.0
Serilog.Settings.Configuration 10.0.1
Serilog.Sinks.Console 6.1.1
```

Infrastructure:

```text
Npgsql.EntityFrameworkCore.PostgreSQL
Microsoft.EntityFrameworkCore
Microsoft.EntityFrameworkCore.Relational
Microsoft.EntityFrameworkCore.Design
```

Application:

```text
FluentValidation
FluentValidation.DependencyInjectionExtensions
```

Tests:

```text
Shouldly
Microsoft.AspNetCore.Mvc.Testing
xUnit
```

### OpenAPI vulnerability fixed

The template initially produced a vulnerability warning for:

```text
Microsoft.OpenApi 2.0.0
```

It was fixed by adding/updating:

```text
Microsoft.OpenApi 2.7.5
```

Build/test later ran without the previous vulnerability warning.

---

## 7. Backend template cleanup completed

The default template files were removed:

```text
backend/src/Miga.Api/Controllers/WeatherForecastController.cs
backend/src/Miga.Api/WeatherForecast.cs
backend/src/Miga.Application/Class1.cs
backend/src/Miga.Contracts/Class1.cs
backend/src/Miga.Domain/Class1.cs
backend/src/Miga.Infrastructure/Class1.cs
backend/tests/Miga.IntegrationTests/UnitTest1.cs
backend/tests/Miga.UnitTests/UnitTest1.cs
```

Created endpoint:

```text
GET /api/health
```

Expected successful response contains:

```json
{
  "status": "healthy",
  "service": "Miga.Api",
  "environment": "Development",
  "utcNow": "..."
}
```

Serilog request logging is configured and logs requests like:

```text
HTTP GET /api/health responded 200
```

---

## 8. Testing decision: Shouldly instead of FluentAssertions

FluentAssertions emitted a license warning about non-commercial use.

Decision:

```text
Remove FluentAssertions.
Use Shouldly instead.
```

The replacement commit was completed successfully.

Current tests pass with:

```powershell
dotnet build
dotnet test
```

The current test suite has 2 tests:

```text
Miga.UnitTests
Miga.IntegrationTests
```

The integration test currently checks `/api/health`, not `/api/health/db`.

Important: do not make integration tests depend on Docker/PostgreSQL yet unless a proper test database strategy is implemented.

---

## 9. PostgreSQL and EF Core infrastructure

The backend was extended with PostgreSQL infrastructure.

### Created/expected files

```text
backend/src/Miga.Infrastructure/Persistence/MigaDbContext.cs
backend/src/Miga.Infrastructure/DependencyInjection/InfrastructureServiceCollectionExtensions.cs
```

### `MigaDbContext`

Current context is intentionally empty because domain entities are not created yet.

It exists only to verify real PostgreSQL connectivity and prepare future migrations.

### Program.cs updated

`Program.cs` now registers infrastructure with:

```csharp
builder.Services.AddInfrastructure(builder.Configuration);
```

### appsettings.json updated

Development/local connection string:

```json
"ConnectionStrings": {
  "MigaDatabase": "Host=localhost;Port=5432;Database=miga_dev;Username=miga_user;Password=miga_password_dev"
}
```

This is acceptable for local development now. For production, use environment variables/secrets.

### Health DB endpoint

Added/expected endpoint:

```text
GET /api/health/db
```

It uses:

```csharp
_dbContext.Database.CanConnectAsync(cancellationToken)
```

Expected success response:

```json
{
  "status": "healthy",
  "database": "PostgreSQL",
  "canConnect": true,
  "utcNow": "..."
}
```

If it cannot connect, it returns HTTP 503.

---

## 10. PostgreSQL Docker issue and resolution

Initial docker-compose used:

```yaml
image: postgres:18
```

This failed because PostgreSQL 18 Docker images changed data directory behavior and the mounted volume at `/var/lib/postgresql/data` caused startup errors.

Resolution:

```yaml
image: postgres:17-alpine
```

And reset local volume with:

```powershell
docker compose down -v
docker compose up -d
```

Current recommended `docker-compose.yml`:

```yaml
services:
  miga-postgres:
    image: postgres:17-alpine
    container_name: miga-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: miga_dev
      POSTGRES_USER: miga_user
      POSTGRES_PASSWORD: miga_password_dev
    ports:
      - "5432:5432"
    volumes:
      - miga_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U miga_user -d miga_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  miga_postgres_data:
```

---

## 11. EF Core version conflict and resolution

A build error occurred because `Miga.Infrastructure` used a higher EF Core version than `Miga.Api` resolved.

Error type:

```text
CS1705
Microsoft.EntityFrameworkCore version conflict
```

Resolution: align EF Core packages to `10.0.9`, especially in `Miga.Infrastructure`.

Commands used conceptually:

```powershell
dotnet add .\src\Miga.Infrastructure\Miga.Infrastructure.csproj package Microsoft.EntityFrameworkCore --version 10.0.9
dotnet add .\src\Miga.Infrastructure\Miga.Infrastructure.csproj package Microsoft.EntityFrameworkCore.Relational --version 10.0.9
dotnet add .\src\Miga.Infrastructure\Miga.Infrastructure.csproj package Microsoft.EntityFrameworkCore.Design --version 10.0.9
dotnet add .\src\Miga.Infrastructure\Miga.Infrastructure.csproj package Npgsql.EntityFrameworkCore.PostgreSQL
```

Then:

```powershell
dotnet clean
dotnet restore
dotnet build
```

Build passed afterwards.

---

## 12. File lock issue and resolution

A build error occurred because the API was still running and Windows locked `Miga.Infrastructure.dll`.

The build log indicated:

```text
The file is being used by another process: Miga.Api
```

Resolution:

```powershell
Stop-Process -Id <PID> -Force
```

or stop the API terminal with:

```text
Ctrl + C
```

Rule for future work:

> Before running `dotnet clean`, `dotnet build`, or `dotnet test`, stop any running `dotnet run` API process.

---

## 13. Git history confirmed

Confirmed commits completed:

```text
e40cc6e chore: initial MIGA project setup
c0888fc chore: clean backend template and add health endpoint
db5f920 chore: replace FluentAssertions with Shouldly
```

The PostgreSQL infrastructure commit was recommended but may or may not already be committed by the user.

Before doing new work, check:

```powershell
git status
git log --oneline --max-count=5
```

If PostgreSQL changes are still uncommitted, commit them before starting frontend changes:

```powershell
git add .
git commit -m "chore: add postgres infrastructure and database health check"
```

---

## 14. Current verified backend status

The user reported that after stopping the locked API process:

```powershell
dotnet build
dotnet test
```

worked successfully.

Latest reported test summary:

```text
Resumen de pruebas: total: 2; con errores: 0; correcto: 2; omitido: 0
Compilación realizado correctamente
```

This confirms the backend compiles and the `/api/health` integration test passes.

Manual `/api/health/db` was expected to be tested separately with Docker running.

---

## 15. Next recommended phase

Do not jump into entities yet unless user asks.

Recommended next phase:

```text
Frontend Fase 1.1 — Base visual + PWA
```

Steps:

1. Confirm PostgreSQL changes are committed.
2. Inspect real frontend files:

```powershell
Get-Content .\frontend\package.json
Get-Content .\frontend\vite.config.ts
Get-Content .\frontend\src\App.tsx
Get-Content .\frontend\src\App.css
Get-Content .\frontend\src\index.css
Get-Content .\frontend\src\main.tsx
Get-Content .\frontend\tsconfig.app.json
```

3. Clean Vite starter.
4. Configure Tailwind and `@tailwindcss/vite`.
5. Configure alias `@` with `vite-tsconfig-paths`.
6. Configure PWA basics with `vite-plugin-pwa`.
7. Add MIGA brand tokens.
8. Create mobile-first landing.
9. Keep design restrictions: no gradients, no decorative tags, no repeated eyebrows, no repeated MIGA naming.
10. Build and commit.

---

## 16. Important workflow rule for Claude

Before proposing code:

1. Ask for or inspect real file contents.
2. Do not invent the current state.
3. Provide complete final files when modifying code.
4. Keep changes small and commit-friendly.
5. Do not generate 30 files at once.
6. Do not skip verification commands.
7. Do not add auth, file upload, AI or native app packaging yet.

---

## 17. Current technical direction

### Frontend

```text
React + TypeScript + Vite + PWA + Tailwind + Zustand + Dexie + React Hook Form + Zod + Recharts
```

### Backend

```text
ASP.NET Core .NET 10 + PostgreSQL + EF Core + modular monolith / clean architecture style
```

### Testing

```text
Vitest / Testing Library frontend later
xUnit + Shouldly backend
```

### Local database

```text
PostgreSQL via Docker Compose using postgres:17-alpine
```

---

## 18. Do not forget

MIGA is not a generic task app. It is a system for:

- goals;
- time sessions;
- reliable timestamp-based timer;
- local-first guest mode;
- materials;
- statistics;
- simulations/exams;
- manual review questions;
- optional account later.

The MVP must remain realistic. The near-term priority is:

```text
PWA + local-first + goals + sessions + reliable timer + basic dashboard
```
