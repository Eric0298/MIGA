# MIGA · Backend

API ASP.NET Core sobre .NET 10 y PostgreSQL. La solución separa API, aplicación, contratos,
dominio e infraestructura; usa ASP.NET Core Identity, cookies opacas y Entity Framework Core.

## Requisitos

- .NET SDK `10.0.301` (fijado en `../global.json`).
- Docker con Compose para PostgreSQL local.
- El tool manifest del repositorio (`dotnet-ef` `10.0.10`).

## Arranque local

Desde la raíz del repositorio:

```bash
cp .env.example .env
# Asigna una contraseña local no reutilizada a POSTGRES_PASSWORD.
docker compose up --build -d miga-postgres

dotnet user-secrets set \
  --project backend/src/Miga.Api \
  "ConnectionStrings:MigaDatabase" \
  "Host=localhost;Port=5432;Database=miga_dev;Username=miga_app;Password=<same-local-password>"
dotnet tool restore
dotnet restore backend/Miga.slnx --locked-mode
dotnet ef database update \
  --project backend/src/Miga.Infrastructure \
  --startup-project backend/src/Miga.Api
dotnet run --project backend/src/Miga.Api
```

La imagen local deriva de PostgreSQL fijado por digest, elimina `gosu` en una fase sin red y
declara `USER postgres`. No sustituyas este build por la referencia base directa: el workflow
escanea la derivada y valida su inicialización sobre un volumen nuevo.

El perfil de desarrollo escucha en las direcciones de `Properties/launchSettings.json`. El frontend
Vite reenvía `/api` a `VITE_API_PROXY_TARGET`; el valor predeterminado es
`http://localhost:5161`.

`GET /api/health` no consulta dependencias. `GET /api/health/db` está mapeado, pero devuelve `404`
si `Health:ExposeDatabaseEndpoint` está desactivado; no debe exponerse públicamente en producción
sin una decisión operativa.

## Configuración y secretos

`backend/.env.example` enumera las variables esperadas, pero ASP.NET Core no carga ese archivo por
sí solo. En desarrollo, expórtalas en el proceso o usa
[user-secrets](https://learn.microsoft.com/aspnet/core/security/app-secrets):

```bash
dotnet user-secrets set \
  --project backend/src/Miga.Api \
  "ConnectionStrings:MigaDatabase" \
  "Host=localhost;Port=5432;Database=miga_dev;Username=miga_app;Password=<local-only-password>"
```

Los marcadores entre `<...>` no son valores válidos. No copies credenciales reales a
`appsettings*.json`, archivos `.env`, comandos registrados en historial, incidencias ni logs.

Producción requiere, como mínimo:

- `ConnectionStrings__MigaDatabase`, con una cuenta de aplicación de privilegio mínimo,
  `SSL Mode=VerifyFull` y `Trust Server Certificate=false`; configura `Root Certificate` con una
  CA montada cuando la CA no pertenezca al almacén de confianza del sistema;
- `AllowedHosts`, `Cors__AllowedOrigins__*`, `TrustedProxies__Addresses__*` y
  `Authentication__PublicBaseUrl` exactos;
- proveedor de correo transaccional real cuando `Authentication__RequireConfirmedEmail=true`,
  seleccionado explícitamente con `EmailDelivery__Provider`. `BrevoApi` publica los correos
  contra `https://api.brevo.com/v3/smtp/email` con la cabecera `api-key`; `Smtp` conserva la
  ruta legacy `System.Net.Mail` para hostings que permitan puertos SMTP salientes. Railway
  Free/Trial/Hobby bloquean 25, 465, 587 y 2525 — en esos planes usa `BrevoApi`;
- keyring de Data Protection persistido en PostgreSQL y protegido con un certificado X.509
  montado desde un gestor de secretos;
- rotación independiente de credenciales PostgreSQL, Brevo/SMTP, certificado y API de YouTube.

Separa siempre dos identidades PostgreSQL:

- el **migrador** recibe temporalmente los permisos DDL necesarios para crear/alterar esquemas,
  tablas, índices y el historial EF; su credencial solo existe durante el job de migración;
- el **runtime** tiene `CONNECT`, `USAGE` de esquema y el DML/secuencias estrictamente necesarios
  para `auth`, `app` y `audit`, pero no es propietario, superusuario ni tiene `CREATEDB`,
  `CREATEROLE`, acceso de escritura a `infra` o permisos DDL.

El usuario bootstrap de PostgreSQL efímero que usa CI sirve para validar migraciones, no demuestra
que los grants de producción sean correctos. El despliegue debe probar la API con la identidad
runtime después de migrar y versionar el procedimiento de grants para el proveedor elegido.

La topología de referencia es `https://app.example.com/api`: el frontend conserva
`VITE_API_URL=/` y el reverse proxy reenvía `/api` al proceso ASP.NET Core. En el ejemplo, el proxy
preserva `Host=app.example.com`, por lo que `AllowedHosts=app.example.com`. Si el proxy reescribe
`Host`, configura el hostname efectivo exacto. La aplicación solo consume `X-Forwarded-For` y
`X-Forwarded-Proto` desde proxies conocidos; el borde debe eliminar `X-Forwarded-Host`. CORS mantiene
una allowlist exacta como defensa en profundidad; no implica que el navegador llame directamente a
otro subdominio.

El proceso valida combinaciones críticas en producción y debe fallar ante configuración
incompleta. La terminación TLS y los headers reenviados solo deben confiar en proxies declarados.

## Autenticación y autorización

- Usuario registrado: ASP.NET Core Identity con contraseña de 12–128 caracteres, PBKDF2 Identity
  V3 a 210 000 iteraciones, email normalizado único y bloqueo tras cinco fallos durante 15 minutos.
- Demo: cookie, sesión y workspace separados de Identity, con datos ficticios y caducidad absoluta
  de dos horas. Al registrar e importar, el workspace se promociona en sitio y conserva su ID para
  mantener válidas las referencias a binarios locales; la revisión del snapshot avanza de forma
  condicional para no perder escrituras concurrentes.
- Cookies de producción: nombres `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` y sin
  `Domain`.
- Sesiones registradas: estado opaco en base de datos, inactividad de 30 minutos y máximo absoluto
  de 24 horas; se validan con el security stamp en cada petición.
- Con email obligatorio, registro responde genéricamente sin guardar el hash de la contraseña ni
  abrir sesión. La confirmación válida recibe una contraseña nueva y la versión de privacidad,
  completa esos campos y convierte la demo pendiente dentro de una transacción.
- `Authentication__UnconfirmedAccountLifetime` limita por defecto a siete días las cuentas sin
  confirmar; también se eliminan si caduca la demo vinculada. El cleanup periódico es local a la
  instancia.
- Confirmación/reset se intentan encolar por ID de usuario en memoria, con capacidad 256 y un
  consumidor. La preparación reintenta hasta cuatro veces antes de iniciar la entrega; una entrega
  iniciada no se reintenta para evitar duplicados. La cola no es durable: saturación, reinicio,
  reintentos de entrega seguros, métricas y varias réplicas requieren diseño operativo antes de
  producción.
- Toda mutación usa antiforgery: el cliente obtiene `GET /api/auth/csrf` y envía
  `X-XSRF-TOKEN`. CORS no sustituye esta comprobación.
- Exportación y eliminación de cuenta requieren reautenticación en los diez minutos anteriores; la
  eliminación también exige la contraseña y el literal `DELETE`.
- El workspace siempre se deriva de la sesión. El API no confía en un `userId` o propietario
  enviado por el navegador.

MIGA no implementa MFA, administración de usuarios ni consola administrativa. La lista local de
contraseñas comunes tampoco alcanza todavía las 3000 entradas de OWASP ASVS 5.0 L2.

## Endpoints

Rutas públicas o de autenticación:

- `GET /api/health`, `GET /api/health/db`
- `GET /api/auth/csrf`, `GET /api/auth/session`
- `POST /api/auth/demo`, `/register`, `/login`, `/logout`
- `POST /api/auth/forgot-password`, `/reset-password`, `/confirm-email`,
  `/resend-confirmation`

Rutas de cuenta registrada:

- `POST /api/auth/change-password`, `/reauthenticate`
- `GET /api/account/export`
- `DELETE /api/account`
- `GET /api/materials/youtube-metadata`

Rutas con workspace demo o registrado:

- `GET /api/data/snapshot`
- `PUT /api/data/snapshot`

Los límites adicionales y contratos completos se documentan en
[`../docs/security/DATA_FLOW_AND_ASSET_MAP.md`](../docs/security/DATA_FLOW_AND_ASSET_MAP.md).
Existe además un límite global de 120 peticiones/minuto por IP. Rate limits, caché de YouTube y
coordinación del cleanup son locales al proceso; deben externalizarse antes de desplegar varias
réplicas.

## Datos y migraciones

PostgreSQL separa los esquemas `auth`, `app` y `audit`. Los snapshots usan revisión optimista y
devuelven `409` ante una escritura obsoleta o si el `workspaceId` de aserción no coincide con el de
la sesión. El servidor nunca usa ese campo del cuerpo para seleccionar el recurso. El límite es
256 KiB para demo y 5 MiB para una cuenta.
PDF, vídeo, voz, imágenes y audio permanecen exclusivamente en IndexedDB: no están en el snapshot,
la exportación de cuenta ni el backup PostgreSQL.

Crear una migración deliberada:

```bash
dotnet ef migrations add <NombreDescriptivo> \
  --project backend/src/Miga.Infrastructure \
  --startup-project backend/src/Miga.Api \
  --output-dir Persistence/Migrations
```

Revisar el diff generado y probar una base limpia y una actualización antes de aplicarla. Para
despliegue, genera un candidato idempotente:

```bash
dotnet ef migrations script --idempotent \
  --project backend/src/Miga.Infrastructure \
  --startup-project backend/src/Miga.Api \
  --output miga-migrations.sql
```

El workflow de CI está configurado para ejecutar el candidato dos veces en una segunda base limpia
y hacer un smoke de la API sobre esa misma base. Solo una ejecución verde valida ese recorrido, y
no sustituye la prueba desde la versión productiva anterior, con volumen representativo y rol
runtime restringido. Verifica el checksum, revisa manualmente el SQL y solo entonces promueve ese
mismo artefacto inmutable.

No se ejecutan down migrations destructivas automáticamente. La estrategia y el restore están en
[`../docs/security/BACKUP_AND_RECOVERY.md`](../docs/security/BACKUP_AND_RECOVERY.md).

## Verificación

```bash
dotnet restore backend/Miga.slnx --locked-mode
dotnet list backend/Miga.slnx package --vulnerable --include-transitive --no-restore
dotnet format backend/Miga.slnx --verify-no-changes --no-restore
dotnet build backend/Miga.slnx --configuration Release --no-restore
dotnet test backend/Miga.slnx --configuration Release --no-build --no-restore
```

Las pruebas cubren autenticación, CSRF, aislamiento entre workspaces, demo, privacidad, validación
de snapshots, health y YouTube. La auditoría y los controles pendientes están en
[`../docs/security/SECURITY_AUDIT.md`](../docs/security/SECURITY_AUDIT.md).
