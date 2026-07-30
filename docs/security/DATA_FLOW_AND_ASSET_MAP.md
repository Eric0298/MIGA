# Mapa de activos y flujos de datos

Fecha de revisión: 30 de julio de 2026.

Este documento describe el código del repositorio. La infraestructura de producción, el dominio, el
proveedor de correo, el almacenamiento de backups y la configuración TLS todavía no existen o no
son verificables aquí.

## 1. Componentes y límites de confianza

```text
┌──────────────── dispositivo del usuario ────────────────┐
│ React/PWA ── IndexedDB por identidad ── blobs locales   │
│     │ HTTPS + cookie HttpOnly + X-XSRF-TOKEN            │
└─────┼──────────────── límite Internet/TLS ───────────────┘
      ▼
┌──────────── infraestructura de aplicación ──────────────┐
│ proxy/CDN (pendiente) → ASP.NET Core API                │
│                         │        │                       │
│                         │        ├─ SMTP (opcional)      │
│                         │        └─ YouTube API          │
│                         ▼                                │
│                    PostgreSQL                            │
│ auth.* / app.* / audit.* / keyring Data Protection     │
└─────────────────────────────────────────────────────────┘
```

Límites:

1. navegador no confiable frente a API;
2. Internet/proxy frente al proceso ASP.NET Core;
3. aplicación frente a PostgreSQL;
4. aplicación frente a SMTP y YouTube Data API;
5. navegador frente al script/frame de YouTube;
6. runtime frente al gestor de secretos y certificado de Data Protection;
7. CI frente al repositorio y registros de paquetes.

La topología objetivo es mismo origen: el navegador usa `https://app.example.com/api`; el reverse
proxy sirve el frontend y reenvía `/api` a ASP.NET Core. Debe retirar cabeceras reenviadas no
confiables y preservar `Host` o configurar `AllowedHosts` con el host efectivo exacto. CORS conserva
una allowlist exacta como defensa en profundidad, no como diseño cross-origin.

El backend es la autoridad para identidad, sesión, autorización, límites y validación de snapshots.
El guard del frontend solo aporta experiencia de usuario.

## 2. Actores

| Actor                       | Identidad                               | Capacidades                                                                                               |
| --------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Visitante                   | ninguna                                 | páginas públicas, estado de sesión, CSRF, registro, login, recuperación y creación limitada de demo       |
| Usuario demo                | cookie/sesión demo y workspace `Demo`   | usar datos ficticios y guardar un snapshot efímero dentro de su workspace                                 |
| Usuario registrado          | ASP.NET Core Identity y sesión servidor | snapshot propio, YouTube, cambio de contraseña, listado/revocación de sesiones, exportación y eliminación |
| Operador de infraestructura | fuera de la aplicación                  | secretos, backups, despliegue, logs y restauración                                                        |
| Administrador de aplicación | **no existe**                           | no hay panel, endpoints ni rol administrativo funcional                                                   |

## 3. Inventario de activos

| Activo                               | Ubicación                       | Sensibilidad                      | Acceso legítimo                                          | Eliminación/retención                                                                                                                                        |
| ------------------------------------ | ------------------------------- | --------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Email normalizado                    | `auth.users`                    | personal                          | propietario y backend de autenticación                   | al eliminar la cuenta                                                                                                                                        |
| Hash de contraseña y estado Identity | `auth.users`                    | crítico                           | Identity                                                 | al eliminar la cuenta                                                                                                                                        |
| Sesiones registradas                 | `auth.user_sessions`            | crítico                           | middleware de cookie y propietario                       | logout, expiración, cambio/reset de contraseña o eliminación                                                                                                 |
| Sesiones demo                        | `app.demo_sessions`             | sensible                          | cookie demo y cleanup                                    | inactividad 30 min, máximo 2 h, revocación o conversión                                                                                                      |
| Workspace                            | `app.workspaces`                | sensible                          | sujeto asociado; nunca se acepta propietario del cliente | demo al caducar/convertir; registrado al borrar cuenta                                                                                                       |
| Snapshot JSON estructurado           | `app.workspace_snapshots`       | personal                          | propietario del workspace                                | con workspace; exportable para cuentas                                                                                                                       |
| Eventos de seguridad                 | `audit.security_events`         | sensible                          | operación/investigación                                  | política definitiva pendiente; `ActorId` puede conservarse tras borrar cuenta                                                                                |
| Keyring Data Protection              | `auth.data_protection_keys`     | crítico                           | proceso API                                              | según rotación del framework; debe respaldarse junto con la base                                                                                             |
| Certificado protector del keyring    | montaje/gestor externo          | crítico                           | proceso API                                              | rotación coordinada; nunca en Git ni dentro del backup sin protección                                                                                        |
| Cookies de sesión                    | navegador                       | crítico                           | navegador; valor `HttpOnly`                              | logout/expiración/revocación                                                                                                                                 |
| Token antiforgery de petición        | memoria React                   | sensible y efímero                | frontend actual                                          | al recargar, cambiar sesión o recibir `csrf_invalid`                                                                                                         |
| IndexedDB `miga-scoped-<hash>`       | navegador                       | personal                          | identidad activa                                         | logout, expiración, `401/403` y cambio de identidad cierran el scope sin borrarlo; borrado local explícito o eliminación de cuenta sí eliminan la base local |
| PDF, vídeo, voz, imagen y audio      | stores blob de IndexedDB        | personal; potencialmente sensible | dispositivo local                                        | eliminación local; **no** se sincronizan ni exportan                                                                                                         |
| Export JSON descargado               | sistema de archivos del usuario | personal, en claro                | usuario                                                  | bajo control del usuario; sin retención servidor                                                                                                             |
| Caché YouTube                        | memoria de la instancia         | metadatos no secretos             | servicio backend                                         | TTL configurado; se pierde al reiniciar                                                                                                                      |
| Contadores de rate limit             | memoria de la instancia         | dato técnico/IP                   | middleware                                               | ventana de minutos/horas; se pierde al reiniciar                                                                                                             |
| Logs de aplicación                   | sink configurado                | sensible                          | operación                                                | destino y retención de producción pendientes                                                                                                                 |

Los objetivos, notas, sesiones, respuestas de examen, hábitos de estudio y archivos pueden revelar
información personal aunque no sean categorías especiales por definición. No deben registrarse
cuerpos completos ni incluirse en telemetría ajena.

## 4. Persistencia del navegador

El frontend:

- deriva un nombre de IndexedDB por identidad;
- no abre la base legacy `miga` tras autenticarse;
- valida por completo el snapshot antes de hidratar;
- sincroniza el formato estructurado v7 con revisión optimista;
- ante `409` conserva la copia local y marca conflicto;
- cierra/desactiva el scope sin borrarlo en logout, expiración, `401/403` o cambio de identidad;
- solo elimina una base scoped mediante borrado local explícito o eliminación de cuenta;
- usa `BroadcastChannel` para propagar invalidaciones entre pestañas.

Limitación crítica: `materialBlobs`, `noteBlobs` y `questionBlobs` permanecen solo en IndexedDB. Los
snapshots API, la exportación de cuenta, el export JSON local y los backups PostgreSQL no contienen
esos bytes. El usuario debe conservar los originales por separado.

## 5. Persistencia servidor

Esquemas y entidades:

| Esquema | Entidades                                                                             |
| ------- | ------------------------------------------------------------------------------------- |
| `auth`  | usuarios/roles Identity, relaciones Identity, `user_sessions`, `data_protection_keys` |
| `app`   | `workspaces`, `workspace_snapshots`, `demo_sessions`                                  |
| `audit` | `security_events`                                                                     |

El esquema está versionado por
`Persistence/Migrations/20260723155637_InitialSecurity.cs`,
`Persistence/Migrations/20260730090542_DeferredDemoConfirmation.cs` y su model snapshot. La segunda
migración hace diferibles la contraseña/aceptación y el vínculo de conversión demo hasta confirmar
el email, con índice único para el workspace pendiente. Ninguna contiene seed de datos ni
credenciales.

Controles relevantes:

- identificadores `Guid`;
- workspace `Demo` o `Registered` con invariantes en modelo/base;
- relación registrada derivada de la identidad servidor;
- sesión demo separada, no Identity;
- revisión optimista del snapshot;
- conversión demo→cuenta en transacción;
- cascadas analizadas para cuenta/workspace/sesiones;
- evento de auditoría sin FK destructiva al usuario.

## 6. Cookies, tokens y sesión

- Cookies registradas y demo distintas; en producción usan prefijo `__Host-`, `Secure`, `HttpOnly`,
  `SameSite=Lax`, `Path=/` y sin `Domain`.
- El token antiforgery se entrega en el cuerpo de `GET /api/auth/csrf`, se conserva en memoria y se
  envía como `X-XSRF-TOKEN`; la cookie antiforgery asociada no es accesible por JavaScript.
- No hay JWT ni refresh token en `localStorage` o `sessionStorage`.
- Las sesiones servidor se validan contra base de datos y security stamp en cada petición,
  fallando cerradas.
- Cuenta: inactividad 30 minutos y máximo absoluto 24 horas.
- Demo: inactividad 30 minutos y máximo absoluto 2 horas.
- Reautenticación sensible válida durante 10 minutos.
- Tokens Identity de confirmación/restablecimiento: caducidad configurada de 30 minutos; el
  frontend los consume desde el fragmento URL y limpia la URL.
- Una cuenta pendiente de confirmación no recibe sesión ni almacena un hash de contraseña. La
  confirmación válida fija contraseña/aceptación y solo convierte la demo si la petición conserva
  la cookie exacta asociada al workspace y sesión pendientes.
- Si esa cookie falta, no coincide o la demo ya no está disponible, la confirmación devuelve
  `409 demo_conversion_unavailable`. El cliente solo puede completar una cuenta nueva sin esos datos
  mediante la decisión explícita `continueWithoutDemoData=true`; no existe fallback silencioso.
- Cuentas no confirmadas se eliminan tras siete días por defecto o antes si caduca su demo
  vinculada. El intervalo es configurable y el job de cleanup sigue siendo local a cada instancia.

## 7. Variables y secretos esperados

| Configuración                                                            | ¿Secreto?                | Uso                                                 |
| ------------------------------------------------------------------------ | ------------------------ | --------------------------------------------------- |
| `ConnectionStrings__MigaDatabase`                                        | sí                       | PostgreSQL                                          |
| `POSTGRES_PASSWORD`                                                      | sí                       | contenedor local                                    |
| `DataProtection__CertificatePassword`                                    | sí                       | abrir certificado del keyring                       |
| `DataProtection__CertificatePath`                                        | sensible                 | montaje del certificado                             |
| `Smtp__Password`                                                         | sí                       | entrega de correo                                   |
| `Smtp__Username`                                                         | sensible                 | entrega de correo                                   |
| `YouTubeApi__ApiKey`                                                     | sí                       | YouTube Data API                                    |
| `AllowedHosts`                                                           | no                       | hostnames aceptados                                 |
| `Cors__AllowedOrigins__*`                                                | no                       | orígenes exactos                                    |
| `TrustedProxies__Addresses__*`                                           | no, pero crítica         | proxies autorizados                                 |
| `Authentication__PublicBaseUrl`                                          | no, pero crítica         | enlaces de correo                                   |
| `Authentication__RequireConfirmedEmail`                                  | no                       | política de acceso                                  |
| `Authentication__PrivacyPolicyVersion`                                   | no                       | consentimiento                                      |
| `Authentication__UnconfirmedAccountLifetime`                             | no, pero crítica         | retención máxima de cuentas sin confirmar           |
| `Authentication__*Timeout`, `Authentication__RecentAuthenticationWindow` | no, pero crítica         | inactividad, caducidad absoluta y ventana de reauth |
| `Demo__MaximumSnapshotBytes`, `Demo__RegisteredMaximumSnapshotBytes`     | no                       | cuotas de persistencia                              |
| `Demo__CleanupInterval`                                                  | no                       | frecuencia de limpieza idempotente                  |
| `Smtp__Enabled`                                                          | no                       | habilitación explícita                              |
| `Smtp__Host`, `Smtp__Port`, `Smtp__UseSsl`, `Smtp__FromAddress`          | sensible según proveedor | transporte y remitente                              |
| `Health__ExposeDatabaseEndpoint`                                         | no                       | exposición controlada de health DB                  |
| `YouTubeApi__Enabled`                                                    | no                       | habilitación explícita                              |
| `YouTubeApi__CacheTtl`                                                   | no                       | caché/cuota de metadatos                            |
| `TrustedProxies__ForwardLimit`                                           | no, pero crítica         | número máximo de proxies confiables                 |

Los ejemplos usan marcadores. Producción debe inyectar secretos desde un gestor y fallar si detecta
valores de desarrollo, ausencia del certificado requerido o combinaciones incoherentes.

## 8. Servicios y procesos externos

| Servicio/proceso          | Datos enviados                                                                    | Control actual                                                                                              | Pendiente                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| PostgreSQL                | identidad, sesiones, snapshots, auditoría, keyring                                | EF parametrizado, runtime DML separado del migrador DDL                                                     | grants/TLS/cifrado/backup del proveedor                                                     |
| SMTP                      | dirección y enlace de confirmación/restablecimiento                               | cola en memoria de 256 IDs; un consumidor; hasta 4 intentos de preparación, sin reintentar entrega iniciada | detectar saturación; entrega durable/idempotente, métricas, proveedor, DPA y SPF/DKIM/DMARC |
| YouTube Data API          | ID de vídeo                                                                       | hosts/ID validados, timeout, caché y rate limit                                                             | restricción de clave/cuota en proveedor                                                     |
| YouTube IFrame API/player | IP, user-agent, referrer y vídeo solicitado desde el navegador según el proveedor | CSP limita script/frame a dominios YouTube; carga solo al usar el reproductor                               | script externo sin SRI/pin; revisión de privacidad/consentimiento                           |
| GitHub Actions            | código y metadatos de build                                                       | permisos mínimos, Actions por SHA                                                                           | workflow remoto aún no ejecutado; ejecutar y proteger checks                                |
| npm/NuGet                 | inventario público de paquetes                                                    | lockfiles, auditorías CI                                                                                    | remediar alertas y verificar CI                                                             |
| Demo cleanup              | filas demo caducadas                                                              | `BackgroundService` idempotente cada 15 min                                                                 | coordinación distribuida si hay varias instancias                                           |
| Cleanup no confirmadas    | usuarios no confirmados y vínculo demo pendiente                                  | borrado SQL por vida máxima/caducidad demo                                                                  | coordinación, lotes y métricas antes de escalar                                             |

No hay webhooks, pagos, analítica o trackers propios de MIGA, IA, subida de ficheros al servidor ni
procesos administrativos. El reproductor YouTube sí crea una conexión directa del navegador con un
tercero y debe reflejarse en la revisión de privacidad.

## 9. Entornos

| Entorno                          | Ejecución/persistencia                                                 | Resultado/diferencias y límites                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Desarrollo                       | Vite, API local y PostgreSQL Compose ligado a loopback                 | email confirmado desactivado y health DB activado en `appsettings.Development.json`; no exponer a Internet       |
| Tests unitarios/frontend locales | xUnit, Vitest, jsdom y `fake-indexeddb`; datos ficticios               | 117/117 backend, 266/266 frontend y 17/17 E2E móvil; no validan TLS/proxy/hosting                                |
| Integración backend local        | `WebApplicationFactory`, SQLite en memoria y remitente de correo falso | 50/50; cubre auth, CSRF, aislamiento, sesiones, demo, sync y UTF-8 inválido; no reproduce todo Npgsql            |
| PostgreSQL real local            | imagen derivada, base efímera y recorrido workflow-equivalente         | verde: migraciones/candidato dos veces y smoke API/demo/snapshot                                                 |
| CI remoto                        | runners GitHub y PostgreSQL derivado de base fijada por digest         | workflow configurado pero aún no ejecutado en GitHub                                                             |
| Producción                       | infraestructura todavía no definida                                    | requiere HTTPS, gestor de secretos, PostgreSQL/backup, certificado, SMTP, observabilidad/SIEM y validación final |

El smoke PostgreSQL local valida arranque y un recorrido público mínimo; no convierte la suite
SQLite en una suite PostgreSQL completa ni prueba grants runtime/migrador, TLS, concurrencia,
upgrade desde la versión productiva anterior o volumen representativo. El usuario bootstrap existe
solo dentro del servicio efímero y no debe reutilizarse como modelo de privilegios de producción.

No existe staging versionado. Las pruebas dinámicas agresivas solo pueden ejecutarse en un entorno
local o staging expresamente controlado.

## 10. Rutas del navegador

Rutas públicas:

- `/`, `/login`, `/registro`, `/recuperar`, `/restablecer`, `/verificar-email`;
- `/demo`, `/privacidad` y `/arquitectura`.

Las rutas bajo `/app/**` requieren una sesión registrada o demo válida; para una cuenta registrada,
el guard también comprueba el estado de confirmación cuando esa política está activa. El guard de
React es solo navegación y UX: cada operación sensible vuelve a autenticarse y autorizarse en la
API. No existe ruta administrativa.

## 11. Flujos principales

### Registro y conversión de demo

1. El navegador obtiene token CSRF.
2. Envía email, contraseña, versión de privacidad y elección explícita de importar demo.
3. El servidor normaliza el email, aplica la política de contraseña y comprueba la versión de
   privacidad.
4. Sin confirmación obligatoria, crea Identity/workspace/sesión y, si se solicitó, convierte la demo
   válida dentro de una transacción.
5. Con confirmación obligatoria, crea una identidad pendiente sin hash de contraseña,
   consentimiento ni sesión; conserva el vínculo al workspace demo y responde genéricamente.
6. La solicitud intenta encolar por ID de usuario un enlace construido desde `PublicBaseUrl`.
7. Al confirmar, el cliente envía contraseña nueva y versión de privacidad. El servidor solo
   convierte la demo pendiente si recibe la cookie exacta de esa sesión/workspace.
8. Si la cookie falta, no coincide, caducó o la demo desapareció, responde `409` sin confirmar. Solo
   `continueWithoutDemoData=true`, tras una decisión explícita del usuario, crea un workspace
   registrado vacío y deja la demo sin convertir.

### Login y recuperación

- Login devuelve mensajes genéricos, aplica lockout y rate limit, rota la sesión y registra evento.
- La cuenta puede listar sus sesiones activas, revocar una propia o revocar todas las demás; las
  consultas siempre filtran por el propietario derivado de la sesión.
- Recuperación y reenvío responden de forma genérica exista o no el email.
- Los tokens son de un solo uso lógico mediante Identity y caducan; no se incluyen en query string
  del request al backend desde la página.
- Cambio/reset de contraseña invalida sesiones según la política implementada.

### Sincronización

1. El servidor identifica el workspace desde la sesión, nunca desde un `userId` cliente.
2. `GET` devuelve revisión y JSON del workspace actual.
3. El navegador valida antes de hidratar.
4. `PUT` envía revisión esperada y JSON; el servidor revalida UTF-8, límites, claves, UUID y
   relaciones. La regresión que podía producir `500` con UTF-8 malformado ahora devuelve
   `400 snapshot_invalid`.
5. Una revisión obsoleta devuelve `409`; no hay last-write-wins silencioso.

### Exportación y eliminación

- Solo cuenta registrada con reautenticación reciente.
- Exportación devuelve los datos estructurados propios, sin hashes, sesiones ni blobs locales.
- Eliminación exige contraseña y literal `DELETE`; elimina cuenta/workspace/sesiones y conserva
  solo el evento de seguridad mínimo.

## 12. Inventario completo de endpoints

Todos los endpoints pasan por el límite global en memoria de 120 peticiones/minuto por IP. Las
mutaciones requieren antiforgery salvo que el código indique explícitamente lo contrario. Los
límites son por instancia y no sustituyen controles distribuidos.

| Método y ruta                              | Acceso                                           | Entrada principal                                                                | Salida                                                | Límite adicional      | Riesgo/control                                                                              |
| ------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------- |
| `GET /api/health`                          | público                                          | ninguna                                                                          | estado mínimo                                         | global                | no consulta dependencias                                                                    |
| `GET /api/health/db`                       | público; funcionalidad deshabilitada por defecto | ninguna                                                                          | estado DB mínimo o `404`                              | global                | la ruta está mapeada, pero devuelve `404` salvo que `Health:ExposeDatabaseEndpoint=true`    |
| `GET /api/auth/csrf`                       | público                                          | cookie asociada                                                                  | `requestToken`                                        | global                | token en memoria, no URL                                                                    |
| `GET /api/auth/session`                    | público                                          | cookies                                                                          | estado autenticado, tipo, expiración y campos mínimos | global                | no devuelve token ni hash                                                                   |
| `POST /api/auth/demo`                      | público                                          | antiforgery                                                                      | `204` y cookie demo                                   | 5/h/IP                | workspace ficticio aislado                                                                  |
| `POST /api/auth/register`                  | público                                          | email, contraseña, versión privacidad, `importDemoData`                          | `204` o `202`                                         | 5/h/IP                | con confirmación requerida difiere contraseña/consentimiento/conversión y responde genérico |
| `POST /api/auth/login`                     | público                                          | email, contraseña                                                                | `204`                                                 | 10/5 min/IP + lockout | respuesta genérica y nueva sesión                                                           |
| `POST /api/auth/logout`                    | público con contexto de cookie                   | antiforgery                                                                      | `204`                                                 | global                | revoca sesión/cookie                                                                        |
| `POST /api/auth/forgot-password`           | público                                          | email                                                                            | `202` genérico                                        | 5/h/IP                | evita enumeración                                                                           |
| `POST /api/auth/reset-password`            | público                                          | email, token, contraseña nueva                                                   | `204`                                                 | 10/h/IP               | token limitado y revocación                                                                 |
| `POST /api/auth/confirm-email`             | público                                          | `userId`, token, contraseña nueva, versión privacidad, `continueWithoutDemoData` | `204` o `409`                                         | 5/h/IP                | cookie demo exacta para convertir; fallback sin datos solo con consentimiento explícito     |
| `POST /api/auth/resend-confirmation`       | público                                          | email                                                                            | `202` genérico                                        | 5/h/IP                | evita enumeración                                                                           |
| `POST /api/auth/change-password`           | registrado                                       | contraseña actual/nueva                                                          | `204`                                                 | 10/h/IP               | política y revocación de sesiones                                                           |
| `POST /api/auth/reauthenticate`            | registrado                                       | contraseña actual                                                                | `204`                                                 | 10/h/IP               | habilita ventana sensible de 10 min                                                         |
| `GET /api/data/snapshot`                   | demo o registrado                                | sesión                                                                           | revisión, fecha y JSON                                | global                | workspace derivado en servidor                                                              |
| `PUT /api/data/snapshot`                   | demo o registrado                                | revisión y JSON UTF-8                                                            | snapshot actualizado o `400`/`409`                    | 30/min/IP             | 256 KiB demo, 5 MiB registrado; UTF-8 inválido → `400`; conflicto optimista → `409`         |
| `GET /api/account/sessions`                | registrado + reauth                              | sesión                                                                           | sesiones activas propias                              | 10/h/IP               | filtro servidor por propietario; no expone tokens/cookies                                   |
| `DELETE /api/account/sessions/{sessionId}` | registrado + reauth                              | ID de sesión propia                                                              | `204` o `404`                                         | 10/h/IP               | filtro por propietario; impide revocar o enumerar sesiones ajenas                           |
| `DELETE /api/account/sessions/others`      | registrado + reauth                              | sesión actual                                                                    | `204`                                                 | 10/h/IP               | revoca todas las sesiones propias salvo la actual                                           |
| `GET /api/account/export`                  | registrado + reauth                              | sesión                                                                           | export propio                                         | global                | sin blobs locales ni campos internos                                                        |
| `DELETE /api/account`                      | registrado + reauth                              | contraseña y `DELETE`                                                            | `204`                                                 | global                | operación transaccional destructiva                                                         |
| `GET /api/materials/youtube-metadata`      | registrado                                       | URL YouTube                                                                      | metadatos mínimos                                     | 10/min/IP             | allowlist de host/ID, timeout y caché                                                       |

### Cobertura de endpoints

“Añadida” significa creada durante esta implementación. Las filas siguientes se ejecutaron dentro
del resultado local de 50/50 tests de integración, salvo que indiquen una carencia concreta; el
workflow remoto todavía no ha terminado correctamente.

| Método y ruta                              | Cobertura automatizada                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`                          | preexistente: `HealthEndpointTest.GetHealth_ShouldReturnHealthyResponse`                                               |
| `GET /api/health/db`                       | añadida: oculto por defecto (`404`) y conectividad habilitada (`200`); falta fallo DB `503`                            |
| `GET /api/auth/csrf`                       | añadida indirectamente por todos los helpers `PostWithCsrfAsync`/`DeleteWithCsrfAsync`                                 |
| `GET /api/auth/session`                    | añadida en `AuthenticationSecurityTests`, `WorkspaceSecurityTests` y `AccountPrivacyTests`                             |
| `POST /api/auth/demo`                      | añadida: CSRF, aislamiento, estabilidad de workspace, límites de payload y autorización                                |
| `POST /api/auth/register`                  | añadida: registro, duplicado genérico, confirmación opcional/obligatoria, conversión demo y rechazo de mass assignment |
| `POST /api/auth/login`                     | añadida: éxito, error genérico, rate limit y sesión secundaria                                                         |
| `POST /api/auth/logout`                    | añadida: revocación servidor y replay de cookie                                                                        |
| `POST /api/auth/forgot-password`           | añadida: enlace por fragmento, reset y respuesta idéntica para email existente/inexistente                             |
| `POST /api/auth/reset-password`            | añadida: un solo uso y revocación de sesiones                                                                          |
| `POST /api/auth/confirm-email`             | añadida: éxito, expiración, un solo uso, cookie demo exacta, `409` y fallback explícito sin datos                      |
| `POST /api/auth/resend-confirmation`       | añadida: respuesta idéntica para cuenta pendiente/inexistente; rate limit cubierto por configuración                   |
| `POST /api/auth/change-password`           | añadida: rotación de sesión actual y revocación de las demás                                                           |
| `POST /api/auth/reauthenticate`            | añadida: ventana requerida para exportar, nueva sesión y rechazo de la cookie previa                                   |
| `GET /api/data/snapshot`                   | añadida: anónimo, demo aislada, conversión y revisión                                                                  |
| `PUT /api/data/snapshot`                   | añadida: aislamiento, `409`, campos desconocidos, tamaño, estructura y UTF-8 malformado → `400`, nunca `500`           |
| `GET /api/account/sessions`                | añadida: listado solo de sesiones propias y requisito de reautenticación                                               |
| `DELETE /api/account/sessions/{sessionId}` | añadida: revocación propia, replay rechazado y aislamiento frente a otra cuenta                                        |
| `DELETE /api/account/sessions/others`      | añadida: revocación de todas las demás sin cerrar la sesión actual                                                     |
| `GET /api/account/export`                  | añadida: reauth, `no-store`, datos propios y exclusión de credenciales                                                 |
| `DELETE /api/account`                      | añadida: confirmación exacta, borrado en cascada, auditoría mínima y revocación                                        |
| `GET /api/materials/youtube-metadata`      | preexistente: validación/respuestas/headers; añadida: denegación a demo                                                |

Evidencia principal:

- `backend/src/Miga.Api/Controllers/*.cs`;
- `backend/src/Miga.Api/Program.cs`;
- `backend/src/Miga.Application/Data/DataSnapshotValidator.cs`;
- `backend/src/Miga.Infrastructure/Auth/`;
- `frontend/src/lib/api/http.ts`;
- `frontend/src/lib/sync/WorkspaceSyncProvider.tsx`.

## 13. Retención

| Categoría                 | Política actual/propuesta                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| Demo                      | eliminación al caducar, revocar o convertir; cleanup cada 15 min                                    |
| Cuenta confirmada         | hasta eliminación por el usuario                                                                    |
| Cuenta sin confirmar      | siete días por defecto o hasta caducidad de demo pendiente; cleanup periódico                       |
| Sesiones                  | hasta logout/expiración/revocación; borrar con cuenta                                               |
| Tokens confirmación/reset | 30 min; inutilizables tras uso exitoso                                                              |
| Snapshot                  | última revisión persistida por workspace                                                            |
| Blobs locales             | se conservan tras logout/expiración/`401`; hasta borrado local explícito, cuenta o navegador        |
| Eventos de seguridad      | retención de producción pendiente; propuesta 90 días online y 1 año archivado según necesidad/legal |
| Logs técnicos             | pendiente de proveedor; minimizar y definir antes de producción                                     |
| Backups                   | propuesta en `BACKUP_AND_RECOVERY.md`; debe respetar borrado diferido documentado                   |

La retención propuesta requiere decisión del propietario y revisión jurídica. No se afirma
cumplimiento normativo por documentarla.
