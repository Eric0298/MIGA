# MIGA — Engineering Handoff for Codex

Date: 2026-07-07  
Repository: `C:\Users\Usuario\Documents\proyectos\MIGA`  
Project: **MIGA**  
Type: **mobile-first PWA** with ASP.NET Core backend.

---

## 1. Purpose

This file gives Codex an engineering handoff of the current project state after the initial setup session.

Use this before modifying files.

Hard rules:

1. Inspect real files before editing.
2. Do not invent code state.
3. Keep changes small.
4. Provide complete file replacements when asked.
5. Do not add unrelated features.
6. Do not generate a large batch of files without explicit approval.

---

## 2. Current repository shape

Expected project root:

```text
MIGA/
├── .gitignore
├── package.json
├── package-lock.json
├── docker-compose.yml               # added during PostgreSQL phase, verify committed
├── frontend/
├── backend/
└── MIGA_AI_RULES/
    ├── CLAUDE/
    └── CODEX/
```

Backend:

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

Note: solution file seen in Git was `Miga.slnx`, not `Miga.sln`.

---

## 3. Confirmed Git commits

Confirmed commits:

```text
e40cc6e chore: initial MIGA project setup
c0888fc chore: clean backend template and add health endpoint
db5f920 chore: replace FluentAssertions with Shouldly
```

The PostgreSQL infrastructure commit was recommended after the last build/test success. It may still be uncommitted.

Before editing, run:

```powershell
git status
git log --oneline --max-count=5
```

If PostgreSQL files are uncommitted and verified, commit them:

```powershell
git add .
git commit -m "chore: add postgres infrastructure and database health check"
```

---

## 4. Frontend installed packages

Root packages:

```text
concurrently
prettier
```

Frontend dependencies installed:

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

Frontend dev dependencies installed:

```text
vite-plugin-pwa
vitest
jsdom
@testing-library/react
@testing-library/jest-dom
@testing-library/user-event
vite-tsconfig-paths
```

ESLint was selected during Vite scaffold.

Do not install `eslint-plugin-jsx-a11y` right now because it conflicted with ESLint 10 peer dependency support.

Do not use `--force` or `--legacy-peer-deps` unless explicitly instructed.

---

## 5. Frontend design constraints

Brand colors:

```css
--miga-apricot: #ff8a4c;
--miga-peach: #ffdcc2;
--miga-cream: #fff7ec;
--miga-charcoal: #1f1f1f;
--miga-pistachio: #a7cda3;
```

Typography fallback installed:

```text
@fontsource-variable/nunito
```

Strict restrictions:

- no gradients;
- no decorative tags/chips/badges;
- no repeated eyebrow labels;
- no repeated `MIGA Dashboard`, `MIGA Goals`, etc.;
- no glassmorphism;
- no generic cold SaaS design;
- no excessive shadows;
- no over-engineered component abstractions.

Mobile-first base width:

```text
360px
```

---

## 6. Backend installed packages

API packages currently expected:

```text
Microsoft.AspNetCore.OpenApi 10.0.9
Microsoft.OpenApi 2.7.5
Serilog.AspNetCore 10.0.0
Serilog.Settings.Configuration 10.0.1
Serilog.Sinks.Console 6.1.1
```

Infrastructure packages should be aligned to EF Core 10.0.9:

```text
Microsoft.EntityFrameworkCore 10.0.9
Microsoft.EntityFrameworkCore.Relational 10.0.9
Microsoft.EntityFrameworkCore.Design 10.0.9
Npgsql.EntityFrameworkCore.PostgreSQL
```

Testing uses:

```text
xUnit
Shouldly
Microsoft.AspNetCore.Mvc.Testing
```

FluentAssertions was intentionally removed because of its license warning.

---

## 7. Backend current endpoints

Implemented:

```text
GET /api/health
GET /api/health/db
```

`/api/health` returns healthy API info.

`/api/health/db` uses EF Core `Database.CanConnectAsync()` and returns:

- `200 OK` when PostgreSQL can connect;
- `503 Service Unavailable` when it cannot.

Current integration test only verifies `/api/health`.

Do not add Docker-dependent integration tests yet unless a controlled test database strategy is implemented.

---

## 8. Backend expected files after PostgreSQL phase

Expected files/updates:

```text
backend/src/Miga.Api/Program.cs
backend/src/Miga.Api/appsettings.json
backend/src/Miga.Api/appsettings.Development.json
backend/src/Miga.Api/Controllers/HealthController.cs
backend/src/Miga.Infrastructure/Persistence/MigaDbContext.cs
backend/src/Miga.Infrastructure/DependencyInjection/InfrastructureServiceCollectionExtensions.cs
backend/src/Miga.Infrastructure/Miga.Infrastructure.csproj
backend/src/Miga.Api/Miga.Api.http
docker-compose.yml
```

Deleted template files:

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

---

## 9. Docker Compose state

Use PostgreSQL 17 Alpine, not 18.

Correct compose file:

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
      - '5432:5432'
    volumes:
      - miga_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U miga_user -d miga_dev']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  miga_postgres_data:
```

PostgreSQL 18 failed due to Docker image data directory changes and existing mounted volume behavior.

If the volume is corrupted or from a previous incompatible image:

```powershell
docker compose down -v
docker compose up -d
```

Safe only while no real data exists.

---

## 10. Local connection string

Expected in `backend/src/Miga.Api/appsettings.json`:

```json
"ConnectionStrings": {
  "MigaDatabase": "Host=localhost;Port=5432;Database=miga_dev;Username=miga_user;Password=miga_password_dev"
}
```

This is local-only. Do not treat this as production config.

Future production config must use environment variables/secrets.

---

## 11. Common errors already encountered

### 11.1 ESLint plugin conflict

`eslint-plugin-jsx-a11y` failed because ESLint 10 was installed and the plugin did not support that peer range.

Do not force install.

### 11.2 Microsoft.OpenApi vulnerability warning

Template had vulnerable `Microsoft.OpenApi 2.0.0` warning.

Fixed with:

```text
Microsoft.OpenApi 2.7.5
```

### 11.3 FluentAssertions license warning

Removed and replaced with Shouldly.

### 11.4 EF Core version conflict

Error:

```text
CS1705
Miga.Infrastructure uses Microsoft.EntityFrameworkCore 10.0.9 but Miga.Api resolved 10.0.4
```

Fix: align EF Core packages to 10.0.9.

### 11.5 PostgreSQL 18 Docker startup failure

Fix: use `postgres:17-alpine` and reset volume.

### 11.6 DLL locked during build

Error:

```text
Miga.Api process locked Miga.Infrastructure.dll
```

Fix:

```powershell
Stop-Process -Id <PID> -Force
```

or stop the running API terminal with `Ctrl + C`.

Before `dotnet clean`, `dotnet build`, or `dotnet test`, stop `dotnet run`.

---

## 12. Verification commands

### Backend

```powershell
cd C:\Users\Usuario\Documents\proyectos\MIGA\backend
dotnet clean
dotnet restore
dotnet build
dotnet test
```

### Docker

```powershell
cd C:\Users\Usuario\Documents\proyectos\MIGA
docker compose up -d
docker compose ps
docker logs miga-postgres --tail 80
```

### API

Terminal 1:

```powershell
cd C:\Users\Usuario\Documents\proyectos\MIGA\backend
dotnet run --project src/Miga.Api/Miga.Api.csproj
```

Terminal 2:

```powershell
Invoke-RestMethod http://localhost:5161/api/health
Invoke-RestMethod http://localhost:5161/api/health/db
```

Expected DB response:

```text
status     : healthy
database   : PostgreSQL
canConnect : True
```

---

## 13. Current build/test status

Latest user-provided successful backend verification:

```text
Compilación realizado correctamente
Resumen de pruebas: total: 2; con errores: 0; correcto: 2; omitido: 0
```

This means the backend compiles and tests pass after stopping any running API process.

---

## 14. Next recommended engineering task

Recommended next phase:

```text
Frontend Fase 1.1 — Base visual + PWA
```

Before editing, inspect these files:

```powershell
Get-Content .\frontend\package.json
Get-Content .\frontend\vite.config.ts
Get-Content .\frontend\src\App.tsx
Get-Content .\frontend\src\App.css
Get-Content .\frontend\src\index.css
Get-Content .\frontend\src\main.tsx
Get-Content .\frontend\tsconfig.app.json
```

Then implement, in small steps:

1. Clean Vite starter.
2. Configure Tailwind with `@tailwindcss/vite`.
3. Configure alias `@` using `vite-tsconfig-paths`.
4. Configure basic PWA via `vite-plugin-pwa`.
5. Add MIGA CSS tokens.
6. Add Nunito variable import.
7. Create mobile-first landing.
8. Build and test.
9. Commit.

Do not start Goals/Sessions/Timer until the base frontend shell is committed.

---

## 15. Product roadmap reminder

MVP priority:

```text
PWA installability
local-first guest mode
IndexedDB/Dexie
goals
sessions
reliable timestamp-based timer
basic dashboard
export/import JSON
```

Out of MVP:

```text
AI
App Store
Google Play
native app packaging
paid services
advanced auth
secure file upload
notifications
complex sync
```

---

## 16. Codex behavior rules

When asked to modify code:

1. Identify exact files involved.
2. Read them first.
3. Produce minimal edits.
4. Preserve current architecture.
5. Do not rewrite unrelated code.
6. Do not introduce new libraries without justification.
7. Provide complete files when requested.
8. Include commands to verify.
9. Include expected output.
10. Recommend commit message.
