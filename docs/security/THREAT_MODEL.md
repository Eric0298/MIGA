# Modelo de amenazas de MIGA

Fecha: 30 de julio de 2026. Metodología principal: STRIDE, complementada con OWASP Top 10:2025 y
análisis de disponibilidad/privacidad.

Este modelo representa el repositorio, no una infraestructura productiva verificada. Debe revisarse
al elegir hosting, SMTP, dominio, observabilidad o almacenamiento de objetos.

## 1. Alcance y supuestos

Incluido:

- PWA React y service worker;
- IndexedDB por identidad y blobs locales;
- API ASP.NET Core;
- Identity, sesiones registradas y demo;
- PostgreSQL, snapshots y keyring Data Protection;
- SMTP y YouTube;
- CI, dependencias, configuración, exportación y eliminación.

Supuestos:

- producción usará HTTPS extremo a extremo;
- el proxy eliminará cabeceras `X-Forwarded-*` aportadas por Internet y solo la IP del proxy
  configurado será confiable;
- PostgreSQL no será público;
- los secretos procederán de un gestor externo;
- no existe administrador ni panel administrativo;
- no hay MFA en esta versión;
- los blobs permanecen local-only.

## 2. Activos críticos

1. hash y factores de autenticación;
2. cookies y sesiones servidor;
3. email, objetivos, notas, sesiones y respuestas de examen;
4. snapshots y aislamiento de workspaces;
5. blobs locales de estudio;
6. keyring y certificado Data Protection;
7. credenciales PostgreSQL, SMTP y YouTube;
8. eventos de auditoría y backups;
9. integridad del código, lockfiles, Actions y artefactos;
10. disponibilidad de demo, registro, API y datos locales.

## 3. Actores y atacantes

- visitante legítimo;
- usuario demo;
- usuario registrado;
- operador del despliegue;
- atacante anónimo automatizado;
- usuario registrado malicioso intentando acceso horizontal;
- atacante con XSS o control del dispositivo;
- atacante de cadena de suministro;
- persona con acceso indebido a base, backup, logs o gestor de secretos;
- proveedor externo comprometido.

No existe rol de administrador de aplicación. Si se añade, necesita un modelo específico, MFA y
controles reforzados antes de exponerse.

## 4. Superficies de ataque

- formularios de auth, recuperación y privacidad;
- cookies, antiforgery y cabeceras de proxy;
- endpoints de snapshot/export/delete/YouTube;
- JSON importado y datos manipulados en IndexedDB;
- PDF, vídeo, audio, imagen y documento procesados localmente;
- CSP, iframes YouTube, PDF.js y service worker;
- PostgreSQL y migraciones;
- SMTP y enlaces de confirmación/reset;
- configuración, logs, backups y artefactos;
- npm, NuGet, imágenes Docker y GitHub Actions;
- proceso de demo y cleanup.

## 5. Escala

| Valor | Probabilidad                                         | Impacto                                    |
| ----- | ---------------------------------------------------- | ------------------------------------------ |
| Baja  | requiere acceso previo o condiciones poco habituales | efecto local/reversible                    |
| Media | viable con interacción o automatización moderada     | afecta una cuenta o disponibilidad parcial |
| Alta  | viable remotamente o con credencial común            | acceso amplio, secretos o pérdida grave    |

Riesgo: **Crítico** (alta/alta), **Alto** (alta/media o media/alta), **Medio** (media/media),
**Bajo** (resto). Es una priorización técnica, no CVSS.

## 6. Amenazas STRIDE

| ID    | STRIDE | Escenario                                                    | P               | I     | Riesgo          | Mitigaciones existentes                                                                                                                  | Riesgo residual/acción                                                                                              |
| ----- | ------ | ------------------------------------------------------------ | --------------- | ----- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| TM-01 | S      | Credential stuffing o fuerza bruta                           | Alta            | Alta  | Crítico inicial | 12–128 caracteres, PBKDF2 IdentityV3 210k, lockout 5/15 min, 10 logins/5 min/IP, respuesta genérica                                      | **Alto**: lista común menor de 3000 y sin credenciales comprometidas/MFA; ampliar denylist/servicio k-anónimo y MFA |
| TM-02 | I      | Enumeración por registro, login o recuperación               | Media           | Media | Medio           | respuestas genéricas en login/forgot/resend; email normalizado; paridad de cuerpo/código probada localmente                              | **Medio**: medir temporización con DB/SMTP reales y repetir en CI remoto                                            |
| TM-03 | S/E    | Robo de cookie o fijación de sesión                          | Media           | Alta  | Alto            | `HttpOnly`, `Secure`, `__Host-`, sesión de referencia, rotación, DB+stamp y UI probada para listar/revocar                               | **Medio**: verificar flags en HTTPS real; dispositivo comprometido y notificación de accesos                        |
| TM-04 | T      | CSRF sobre mutaciones                                        | Media           | Alta  | Alto            | cookie antiforgery HttpOnly + token en memoria y cabecera `X-XSRF-TOKEN`; CORS exacto; pruebas locales ejecutadas                        | **Bajo/Medio**: CI remoto y configuración real de proxy/CORS                                                        |
| TM-05 | T/E    | XSS almacenado/reflejado/DOM                                 | Media           | Alta  | Alto            | React escapa texto, no hay rich text servidor, CSP frontend/API, tokens fuera de Web Storage                                             | **Medio**: CSP permite orígenes necesarios para YouTube/blob; revisar cada cambio y ejecutar DAST                   |
| TM-06 | T      | SQL/inyección/mass assignment                                | Media           | Alta  | Alto            | EF Core parametrizado, DTOs explícitos, JSON strict, propiedades permitidas, no SQL crudo con entrada                                    | **Bajo/Medio**: mantener análisis CodeQL y tests de propiedades desconocidas                                        |
| TM-07 | T/I    | Prototype pollution al importar/sincronizar                  | Media           | Media | Medio           | Zod strict, claves de prototipo prohibidas, tipos/límites/relaciones verificados                                                         | **Bajo**: fuzzing de importación y payloads anidados                                                                |
| TM-08 | E/I    | IDOR/BOLA entre usuarios o demo/registrado                   | Media           | Alta  | Alto            | workspace derivado de la sesión; políticas `Workspace`/`Registered`; demo separada; tests A/B/demo locales                               | **Bajo/Medio**: mantener cobertura por recurso y ejecutarla en CI remoto; grants productivos pendientes             |
| TM-09 | E      | Escalada vertical a funciones administrativas                | Baja            | Alta  | Medio           | no hay rol, cuenta ni panel administrativo; rol no se acepta al registrar                                                                | **Bajo** ahora; un futuro admin exige modelo nuevo y MFA                                                            |
| TM-10 | T      | Conversión de demo ajena o mezcla de datos                   | Media           | Alta  | Alto            | importación explícita y transacción; confirmación solo convierte con la cookie demo exacta o descarta mediante `continueWithoutDemoData` | **Medio**: casos locales pasaron; faltan carrera/cleanup multiinstancia y CI remoto                                 |
| TM-11 | D      | Creación automatizada masiva de demos/cuentas                | Alta            | Media | Alto            | 5/h/IP, límites de snapshot y caducidad demo                                                                                             | **Medio/Alto** multiinstancia: rate limit en memoria; usar gateway/Redis y métricas                                 |
| TM-12 | D/I    | Abuso de snapshot o import JSON enorme/corrupto              | Media           | Alta  | Alto            | import local 5 MiB; demo 256 KiB, registrado 5 MiB; colecciones acotadas; revisión optimista; UTF-8 estricto                             | **Medio**: presión de CPU sigue posible; medir y aplicar límites de request en proxy/Kestrel                        |
| TM-13 | T/I    | Manipulación directa de IndexedDB                            | Alta            | Media | Alto            | cliente tratado como no confiable; revalidación antes de sincronizar/hidratar; DB por identidad                                          | **Bajo/Medio**: dispositivo comprometido puede alterar sus propios datos; no usar cliente para autorización         |
| TM-14 | I/D    | Conflicto de dos dispositivos/pestañas                       | Media           | Media | Medio           | revisión optimista; `409` conserva local y la UI exige elegir y confirmar copia local o remota                                           | **Medio**: no hay merge automático; documentar soporte y probar con varios dispositivos reales                      |
| TM-15 | I      | Caché de datos privados en navegador/CDN/SW                  | Media           | Alta  | Alto            | `/api` NetworkOnly, `_headers` no-store para API/auth, denylist de navegación                                                            | **Medio** hasta verificar cabeceras reales del hosting                                                              |
| TM-16 | T/I    | Service worker comprometido o actualización defectuosa       | Baja/Media      | Alta  | Alto            | assets con hash, prompt de actualización, cleanup de cachés, API no cacheada                                                             | **Medio**: rollback con Dexie forward-only; despliegue atómico y compatibilidad de esquema                          |
| TM-17 | I/D    | Pérdida de blobs locales                                     | Alta            | Alta  | Crítico         | UI advierte local-only; no se envían al servidor                                                                                         | **Alto**: snapshot/export/backups servidor los excluyen; conservar originales y diseñar backup binario explícito    |
| TM-18 | I      | Backup/restore inconsistente o comprometido                  | Media           | Alta  | Alto            | procedimiento documentado, keyring junto a DB, checks y restore aislado propuestos                                                       | **Alto** hasta automatizar y ensayar en proveedor                                                                   |
| TM-19 | I      | Secreto en Git, logs, artefactos o entorno                   | Media           | Alta  | Alto            | `.gitignore`, ejemplos vacíos, Gitleaks local de fuente/historial sin hallazgos, logs sin cuerpos/tokens                                 | **Medio**: antigua contraseña dev sigue en historial y requiere rotación si se reutilizó; job remoto aún pendiente  |
| TM-20 | S/T    | Cabeceras `X-Forwarded-*` falsificadas alteran IP/rate limit | Media           | Alta  | Alto            | allowlist de proxies y `ForwardLimit`                                                                                                    | **Medio/Alto** hasta configurar proxy real y eliminar cabeceras entrantes                                           |
| TM-21 | I      | CORS demasiado amplio o credenciales cross-origin            | Media           | Alta  | Alto            | allowlist exacta, credenciales solo para orígenes configurados                                                                           | **Bajo/Medio**: validar dominio final y pruebas de origen rechazado                                                 |
| TM-22 | I      | Clickjacking/tabnabbing                                      | Media           | Media | Medio           | CSP `frame-ancestors`, `X-Frame-Options`, COOP                                                                                           | **Bajo** tras verificar en hosting                                                                                  |
| TM-23 | I      | SSRF/open redirect/path traversal                            | Baja/Media      | Alta  | Alto            | YouTube restringe esquema/host/ID; `PublicBaseUrl` configurado; sin rutas servidor basadas en nombre de usuario                          | **Bajo/Medio**: no seguir redirects externos y validar despliegue/SMTP                                              |
| TM-24 | I/R    | Token de reset/confirmación filtrado por URL/log/referrer    | Media           | Alta  | Alto            | token en fragmento, estado React y limpieza de URL; caducidad 30 min; pruebas locales/E2E finales ejecutadas                             | **Medio**: proveedor de correo y navegador reales siguen siendo límites                                             |
| TM-25 | R      | Repudio por auditoría insuficiente                           | Media           | Media | Medio           | `audit.security_events` y logs estructurados sin email/token/cuerpo                                                                      | **Medio**: sink/SIEM externo, retención, alertas, acceso y reloj sincronizado pendientes                            |
| TM-26 | I      | Error o log expone stack, consulta o secreto                 | Media           | Alta  | Alto            | `ProblemDetails`/handler central, errores genéricos; regresión UTF-8 devuelve `400` en vez de `500`                                      | **Medio** hasta probar `Production` y sink/SIEM real; nunca activar debug                                           |
| TM-27 | D      | SMTP/YouTube/PostgreSQL no disponible                        | Media           | Media | Medio           | timeout YouTube; cola de 256 IDs; hasta 4 intentos de preparación, sin reintentar una entrega ya iniciada                                | **Medio/Alto**: cola no durable, saturación/reinicio sin garantía; faltan entrega idempotente, métricas y SLO       |
| TM-28 | T/I    | Dependencia, Action, imagen o script externo comprometido    | Media           | Alta  | Alto            | locks, Actions SHA; PostgreSQL de digest sin `gosu`, no-root; rescan local final 0 H/C el 2026-07-30                                     | **Medio/Alto**: CI derivada aún debe quedar verde; falta SBOM y el IFrame API de YouTube no ofrece SRI/pin estable  |
| TM-29 | T/I    | Artefacto construido con secretos o desde PR no confiable    | Media           | Alta  | Alto            | permisos Actions mínimos, `persist-credentials:false`, no `pull_request_target`                                                          | **Bajo/Medio**: revisar cualquier futuro workflow de deploy y sus entornos                                          |
| TM-30 | D      | Rate limit y caché inconsistentes en varias instancias       | Alta al escalar | Media | Alto            | controles en memoria por instancia                                                                                                       | **Alto al escalar**: Redis/gateway compartido; cleanup demo con coordinación                                        |
| TM-31 | I      | Configuración TLS/cifrado en reposo insegura                 | Media           | Alta  | Alto            | HSTS/redirección y certificado de keyring requeridos por código                                                                          | **Alto**: proveedor no elegido; TLS DB, KMS y cifrado backup no verificables                                        |
| TM-32 | R/I    | Texto de privacidad incorrecto o retención no aplicada       | Media           | Alta  | Alto            | pantalla ES/EN/VA; cuenta sin confirmar caduca en siete días por defecto o con su demo; cleanup local                                    | **Alto legal/operativo**: revisión jurídica, identidad responsable, plazos definitivos, métricas y coordinación     |
| TM-33 | D      | UTF-8 malformado provocaba excepción y respuesta `500`       | Media           | Media | Medio inicial   | decodificación estricta y validador convierten el caso en `400 snapshot_invalid`; pruebas unitaria/integración locales                   | **Bajo/Medio**: extender regresión a nuevos parsers/formatos; carga, Production y monitorización pendientes         |

## 7. OWASP Top 10:2025

Referencia: [OWASP Top 10:2025](https://owasp.org/Top10/).

| Categoría                                  | Aplicación a MIGA                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| A01 Broken Access Control                  | políticas servidor, workspace derivado de sesión y tests cruzados locales ejecutados      |
| A02 Security Misconfiguration              | secretos, hosts, CORS, proxy, CSP, health DB y modo Production                            |
| A03 Software Supply Chain Failures         | npm/NuGet/Docker/Actions, lockfiles, Dependabot, CodeQL, Gitleaks y Trivy                 |
| A04 Cryptographic Failures                 | Identity PBKDF2, TLS, keyring Data Protection, certificado y backups cifrados             |
| A05 Injection                              | EF parametrizado, DTOs, JSON strict, validación URL y prevención de prototype pollution   |
| A06 Insecure Design                        | demo separada, reauth, revisión optimista y privacidad desde diseño                       |
| A07 Authentication Failures                | lockout/rate limit, sesiones servidor, recuperación; MFA y lista amplia pendientes        |
| A08 Software or Data Integrity Failures    | lockfiles, artefactos inmutables, hashes/restore y migraciones                            |
| A09 Security Logging and Alerting Failures | eventos estructurados; sink, alertas y retención pendientes                               |
| A10 Mishandling of Exceptional Conditions  | handler global, fallos cerrados, UTF-8 inválido → `400`, conflictos `409`; caos pendiente |

## 8. Riesgos aceptados temporalmente

No son “resueltos”:

- blobs exclusivamente locales;
- MFA ausente;
- lista de contraseñas comunes inferior a 3000;
- rate limit, caché y cleanup no coordinados entre instancias;
- conflictos `409` requieren intervención;
- correo, hosting/TLS/proxy, cifrado de proveedor, backup restore/DR y alertas/SIEM sin verificar;
- roles/grants de producción y upgrade desde una versión anterior sin ensayar;
- carga y coordinación multiinstancia sin validar;
- textos legales pendientes;
- CI remoto configurado pero no verificado hasta una ejecución correcta.

## 9. Revisión

Actualizar este modelo:

- antes de producción;
- al añadir un proveedor, admin, MFA, storage o nueva integración;
- tras una vulnerabilidad alta/crítica;
- como mínimo cada seis meses.
