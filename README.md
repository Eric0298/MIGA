# MIGA

> Small actions. Big progress.

MIGA es una PWA mobile-first para gestionar metas, sesiones de estudio, materiales, notas,
preguntas de repaso y simulacros. Permite probar una demo con datos ficticios o crear una cuenta
persistente. La aplicación no incluye IA, pagos ni aplicación nativa.

> **Estado:** el repositorio incorpora controles de seguridad y pruebas, pero todavía no debe
> considerarse listo para producción. Faltan configurar y verificar infraestructura real, correo,
> copias de seguridad, observabilidad, dominio/TLS, protección de rama y revisión jurídica.

## Arquitectura

```text
frontend/          React 19 + TypeScript + Vite + Tailwind + PWA
backend/           ASP.NET Core (.NET 10) + Identity + EF Core + PostgreSQL
docs/security/     Auditoría, amenazas, ASVS, backup, incidentes y despliegue
MIGA_AI_RULES/     Reglas de producto, diseño y flujo de trabajo
docker-compose.yml PostgreSQL local, ligado a 127.0.0.1
```

- El navegador autentica mediante cookies `HttpOnly`; no guarda tokens de sesión en Web Storage.
- La topología objetivo es mismo origen: el navegador usa `/api` y el proxy del dominio de la app
  reenvía esa ruta a ASP.NET Core.
- El backend mantiene sesiones de referencia, workspaces de usuario/demo y snapshots JSON
  estructurados.
- IndexedDB usa una base separada por identidad. Los PDF, vídeos, audios e imágenes permanecen
  **solo en ese navegador**: no se sincronizan, no aparecen en el export JSON y no quedan cubiertos
  por backups de PostgreSQL.
- La demo usa un workspace y una cookie distintos de los de una cuenta registrada.
- El reproductor incrustado carga el IFrame API de YouTube y puede comunicar datos técnicos al
  tercero; la CSP limita su origen, pero el script no ofrece SRI ni pin estable.

El inventario detallado está en
[DATA_FLOW_AND_ASSET_MAP.md](docs/security/DATA_FLOW_AND_ASSET_MAP.md).

## Requisitos

- Node.js `22.20.0` (la misma versión que CI).
- npm con soporte para lockfile v3.
- .NET SDK definido por `global.json` (`10.0.301`, último parche compatible).
- Docker Desktop o Docker Engine con Compose v2.
- PowerShell, Bash o una terminal equivalente.

No uses `npm install` para preparar una copia reproducible; usa `npm ci`.

## Inicio rápido local

### 1. Instalar herramientas y dependencias

```bash
npm ci --ignore-scripts
npm --prefix frontend ci --ignore-scripts
dotnet tool restore
dotnet restore backend/Miga.slnx --locked-mode
```

Los scripts de instalación npm están deshabilitados deliberadamente. Si una actualización futura
necesita uno, debe revisarse antes de retirar `--ignore-scripts`.

### 2. Preparar configuración local

Copia los ejemplos, nunca valores reales al repositorio:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

En PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env.local
```

Edita `.env` y sustituye los marcadores por una contraseña local larga y aleatoria. Docker Compose
lee ese archivo; ASP.NET Core **no** lo carga automáticamente. Configura la misma conexión en
variables del proceso, User Secrets o tu gestor local de secretos. Por ejemplo, solo en desarrollo:

```bash
dotnet user-secrets set "ConnectionStrings:MigaDatabase" "<local-connection-string>" \
  --project backend/src/Miga.Api
```

Evita reutilizar esa contraseña y recuerda que pasar secretos como argumento puede dejarlos en el
historial de la terminal. En producción deben proceder de un gestor de secretos.

El frontend usa en desarrollo:

- `VITE_API_URL=/`, para conservar mismo origen;
- `VITE_API_PROXY_TARGET`, para que Vite reenvíe `/api` al backend local.

En producción conserva `VITE_API_URL=/`: sirve frontend y `/api` bajo el mismo origen HTTPS. El
reverse proxy debe eliminar cabeceras reenviadas aportadas por Internet, añadir solo las suyas y
preservar `Host` o configurar `AllowedHosts` con el host efectivo exacto.

Consulta `.env.example`, `backend/.env.example` y `frontend/.env.example` para conocer todas las
variables esperadas. Ningún ejemplo debe contener credenciales válidas.

### 3. Arrancar PostgreSQL y aplicar migraciones

```bash
docker compose up -d

dotnet ef database update \
  --project backend/src/Miga.Infrastructure \
  --startup-project backend/src/Miga.Api
```

Generar una migración nueva es una acción de desarrollo, no de arranque:

```bash
dotnet ef migrations add <NombreDescriptivo> \
  --project backend/src/Miga.Infrastructure \
  --startup-project backend/src/Miga.Api \
  --output-dir Persistence/Migrations
```

Revisa siempre el SQL generado. En producción no se deben ejecutar migraciones destructivas
automáticamente al iniciar la aplicación.

### 4. Ejecutar backend y frontend

En terminales separadas:

```bash
dotnet run --project backend/src/Miga.Api
npm --prefix frontend run dev
```

- Frontend: `http://localhost:5173`.
- Backend HTTP local habitual: `http://localhost:5161`.
- `GET /api/health`: liveness público.
- `GET /api/health/db`: está mapeado, pero devuelve `404` salvo que
  `Health__ExposeDatabaseEndpoint=true`.

No expongas el servidor de desarrollo ni PostgreSQL a Internet.

## Demo, registro y sesiones

- `/demo` inicia una sesión efímera con datos ficticios y límites propios.
- `/registro` crea una cuenta. Si la confirmación de email está activada, el acceso persistente
  depende de un SMTP real y configurado.
- Las operaciones mutantes requieren cookie de sesión y antiforgery mediante
  `X-XSRF-TOKEN`.
- Exportar o eliminar una cuenta exige reautenticación reciente; eliminar exige además contraseña y
  una confirmación explícita.
- No existe panel ni rol administrativo en esta versión.
- No existe MFA. Por ello no se afirma cumplimiento ASVS nivel 2.

## Comprobaciones locales

```bash
# Formato
npm run format:check

# Frontend
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run e2e

# Backend
dotnet format backend/Miga.slnx --verify-no-changes --no-restore
dotnet build backend/Miga.slnx --configuration Release --no-restore
dotnet test backend/Miga.slnx --configuration Release --no-build --no-restore

# Dependencias
npm audit --omit=dev --audit-level=high
npm --prefix frontend audit --omit=dev --audit-level=high
dotnet list backend/Miga.slnx package --vulnerable --include-transitive --no-restore
```

GitHub Actions configura formato, lint, tipos, tests unitarios/integración/E2E, build, auditoría de
dependencias, Gitleaks, CodeQL, Trivy y validación de migraciones sobre PostgreSQL efímero. Genera
un SQL idempotente con checksum y retención de siete días; no contiene datos de aplicación. Su mera
presencia no demuestra éxito: los controles se consideran verificados únicamente cuando el
workflow termina correctamente en GitHub.

## Datos locales y copias

El snapshot y el export JSON contienen datos estructurados, pero no los blobs binarios. Antes de
borrar datos del navegador, cambiar de dispositivo o desinstalar la PWA:

1. exporta los datos estructurados;
2. conserva por separado los documentos y medios originales;
3. verifica que puedes abrir ambas copias.

Consulta [BACKUP_AND_RECOVERY.md](docs/security/BACKUP_AND_RECOVERY.md). Una copia nunca restaurada
no se considera verificada.

## Seguridad y privacidad

- Política para reportar vulnerabilidades: [SECURITY.md](SECURITY.md).
- Auditoría y riesgos residuales: [SECURITY_AUDIT.md](docs/security/SECURITY_AUDIT.md).
- Modelo de amenazas: [THREAT_MODEL.md](docs/security/THREAT_MODEL.md).
- Matriz OWASP ASVS 5.0: [OWASP_ASVS_CHECKLIST.md](docs/security/OWASP_ASVS_CHECKLIST.md).
- Respuesta a incidentes: [INCIDENT_RESPONSE.md](docs/security/INCIDENT_RESPONSE.md).
- Checklist de producción:
  [DEPLOYMENT_SECURITY_CHECKLIST.md](docs/security/DEPLOYMENT_SECURITY_CHECKLIST.md).

Los textos de privacidad incluidos en la aplicación son informativos y están marcados como
**pendientes de revisión jurídica**. El repositorio no afirma cumplimiento pleno del RGPD ni de otra
normativa.
