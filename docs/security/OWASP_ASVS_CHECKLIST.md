# Checklist OWASP ASVS 5.0.0

Fecha: 23 de julio de 2026.

Referencia normativa:
[OWASP Application Security Verification Standard 5.0.0](https://github.com/OWASP/ASVS/tree/v5.0.0).
Los identificadores se fijan como `v5.0.0-X.Y.Z`, siguiendo la recomendación del propio proyecto.

## Alcance y significado

- **Aplicabilidad:** toda fila con estado `Verificado` o `Parcial` es aplicable a MIGA. Una fila
  `N/A` identifica explícitamente la tecnología ausente y la condición que obliga a reevaluarla.
- **Verificado:** hay evidencia estática concreta en el repositorio. No implica que el hosting esté
  probado ni que una prueba marcada como pendiente haya pasado.
- **Parcial:** existe parte del control o depende de pruebas/infraestructura.
- **N/A:** la tecnología o función no existe en MIGA.

La columna **Evidencia** identifica el símbolo, fichero o prueba principal. Cuando usa un nombre de
componente, su ubicación se resuelve con este índice:

| Área mencionada                      | Código/configuración principal                                                                                  | Pruebas principales                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| auth, sesión, CSRF, CORS, rate limit | `backend/src/Miga.Api/Program.cs`, `Controllers/AuthController.cs`, `Infrastructure/Auth/`                      | `AuthenticationSecurityTests.cs`                             |
| autorización, workspace y snapshot   | `Controllers/DataController.cs`, `CurrentActor.cs`, `DataSnapshotValidator.cs`                                  | `WorkspaceSecurityTests.cs`, `DataSnapshotValidatorTests.cs` |
| exportación/eliminación              | `Controllers/AccountController.cs`                                                                              | `AccountPrivacyTests.cs`                                     |
| YouTube/URL externa                  | `Controllers/MaterialsController.cs`, `Infrastructure/Materials/`, `frontend/src/lib/api/youtube-iframe-api.ts` | `YouTubeMetadataEndpointTest.cs`, tests `Materials/`         |
| frontend, IndexedDB y PWA            | `frontend/src/lib/api/`, `frontend/src/lib/db/`, `frontend/src/lib/sync/`, `frontend/vite.config.ts`            | tests colocalizados `*.test.ts(x)`                           |
| headers y despliegue                 | `SecurityHeadersMiddleware.cs`, `frontend/public/_headers`, `.github/workflows/security-ci.yml`                 | inspección del dominio/CI pendiente donde se indique         |

Esta no es una certificación exhaustiva. **MIGA no alcanza ni declara ASVS L2**, entre otros motivos
porque no dispone de MFA (`v5.0.0-6.3.3`), la lista de contraseñas comunes es inferior a las 3000
requeridas (`v5.0.0-6.2.4`) y varios controles TLS, logging, backups y secretos dependen de
infraestructura no verificada.

## V1. Codificación y sanitización

| ID             |   L | Estado     | Evidencia                                                                          | Pendiente/riesgo                                                  |
| -------------- | --: | ---------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `v5.0.0-1.2.2` |   1 | Verificado | URL API resuelta por `frontend/src/lib/api/http.ts`; YouTube valida esquemas/hosts | mantener allowlists por integración                               |
| `v5.0.0-1.2.4` |   1 | Verificado | EF Core/Npgsql; no se encontró SQL crudo con input                                 | revisar cualquier SQL futuro                                      |
| `v5.0.0-1.3.1` |   1 | N/A        | no hay editor rich HTML ni render de HTML de usuario                               | reevaluar si se añade Markdown/HTML                               |
| `v5.0.0-1.3.2` |   1 | Verificado | sin `eval`/ejecución dinámica en código funcional revisado                         | CodeQL pendiente de ejecución                                     |
| `v5.0.0-1.3.6` |   2 | Verificado | `YouTubeUrlParser` limita protocolo, host e ID                                     | seguir redirects externos debe continuar deshabilitado/controlado |
| `v5.0.0-1.5.2` |   2 | Verificado | Zod strict y `DataSnapshotValidator`; no deserialización polimórfica cliente       | fuzzing pendiente                                                 |

## V2. Validación y lógica

| ID             |   L | Estado     | Evidencia                                                               | Pendiente/riesgo                               |
| -------------- | --: | ---------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| `v5.0.0-2.1.1` |   1 | Verificado | límites en schemas frontend, contratos y `DataSnapshotValidationLimits` | mantener mapa al cambiar modelo                |
| `v5.0.0-2.1.3` |   2 | Verificado | límites auth, snapshot, demo y archivos documentados                    | conexión/pools externos pendientes             |
| `v5.0.0-2.2.1` |   1 | Verificado | allowlists, rangos, UUID, unicidad y relaciones                         | tests de frontera finales                      |
| `v5.0.0-2.2.2` |   1 | Verificado | backend revalida snapshot; no confía en validación React                | ninguna autorización debe mudarse al cliente   |
| `v5.0.0-2.3.3` |   2 | Verificado | conversión demo, importación y eliminación usan transacciones           | probar rollback por fallo intermedio           |
| `v5.0.0-2.4.1` |   2 | Parcial    | rate limit por IP y lockout                                             | estado en memoria evade límites multiinstancia |

## V3. Seguridad del frontend web

| ID             |   L | Estado     | Evidencia                                                                                  | Pendiente/riesgo                                                         |
| -------------- | --: | ---------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `v5.0.0-3.2.2` |   1 | Verificado | React representa notas/títulos como texto                                                  | revisión continua de sinks DOM                                           |
| `v5.0.0-3.3.1` |   1 | Parcial    | cookies `Secure` y prefijo `__Host-` en Production                                         | verificar en dominio HTTPS                                               |
| `v5.0.0-3.3.2` |   2 | Verificado | `SameSite=Lax` de sesión y política antiforgery                                            | validar necesidad si cambia topología                                    |
| `v5.0.0-3.3.3` |   2 | Parcial    | prefijo `__Host-` en Production                                                            | entorno local no puede usarlo sin HTTPS                                  |
| `v5.0.0-3.3.4` |   2 | Verificado | cookies de sesión y antiforgery no accesibles por script                                   | token de petición solo en memoria                                        |
| `v5.0.0-3.4.1` |   1 | Parcial    | `UseHsts` fuera de Development                                                             | max-age/subdominios/TLS requieren hosting                                |
| `v5.0.0-3.4.2` |   1 | Verificado | CORS con orígenes exactos, sin wildcard                                                    | dominio final y tests de rechazo                                         |
| `v5.0.0-3.4.3` |   2 | Parcial    | CSP en middleware y `_headers`                                                             | verificar que el proveedor la aplica; CSP report endpoint ausente        |
| `v5.0.0-3.4.4` |   2 | Parcial    | `nosniff` en API y `_headers`                                                              | comprobar todas las respuestas del hosting                               |
| `v5.0.0-3.4.5` |   2 | Parcial    | Referrer-Policy y tokens en fragmento                                                      | verificación externa pendiente                                           |
| `v5.0.0-3.4.6` |   2 | Parcial    | `frame-ancestors` y X-Frame-Options                                                        | verificar frontend desplegado                                            |
| `v5.0.0-3.5.1` |   1 | Verificado | antiforgery cookie+header en mutaciones                                                    | suite de integración completa pendiente                                  |
| `v5.0.0-3.6.1` |   3 | Parcial    | `youtube-iframe-api.ts` inyecta `https://www.youtube.com/iframe_api`; CSP limita el origen | script externo sin SRI ni pin de versión; revisar alternativa/aceptación |

## V4. API y servicios web

| ID             |   L | Estado     | Evidencia                                                       | Pendiente/riesgo                               |
| -------------- | --: | ---------- | --------------------------------------------------------------- | ---------------------------------------------- |
| `v5.0.0-4.1.1` |   1 | Verificado | controladores JSON/ProblemDetails y export con tipos explícitos | pruebas HTTP finales                           |
| `v5.0.0-4.1.3` |   2 | Parcial    | `TrustedProxies` valida direcciones y límite                    | proxy real debe borrar cabeceras no confiables |
| `v5.0.0-4.1.4` |   3 | Parcial    | routing ASP.NET limita métodos declarados                       | proxy debe bloquear TRACE y métodos no usados  |
| `v5.0.0-4.3.1` |   2 | N/A        | no hay GraphQL                                                  | reevaluar si se añade                          |
| `v5.0.0-4.4.1` |   1 | N/A        | no hay WebSocket                                                | reevaluar si se añade                          |

## V5. Archivos

| ID             |   L | Estado       | Evidencia                                               | Pendiente/riesgo                                              |
| -------------- | --: | ------------ | ------------------------------------------------------- | ------------------------------------------------------------- |
| `v5.0.0-5.1.1` |   2 | Parcial      | MIME/tamaños locales en `frontend/src/lib/db/schema.ts` | documentación de archivos maliciosos y magic bytes incompleta |
| `v5.0.0-5.2.1` |   1 | Verificado   | límites para PDF, vídeo, voz, documento e imagen        | son controles locales, no servidor                            |
| `v5.0.0-5.2.2` |   1 | Parcial      | MIME/extensión/metadata se validan localmente           | no hay inspección robusta de magic bytes en todos los tipos   |
| `v5.0.0-5.3.1` |   1 | N/A servidor | no se suben archivos al servidor/webroot                | blobs locales siguen siendo no confiables                     |
| `v5.0.0-5.4.3` |   2 | N/A servidor | no se sirven uploads desde backend                      | antivirus necesario si se añade storage                       |

## V6. Autenticación

| ID              |   L | Estado      | Evidencia                                                  | Pendiente/riesgo                                  |
| --------------- | --: | ----------- | ---------------------------------------------------------- | ------------------------------------------------- |
| `v5.0.0-6.1.1`  |   1 | Verificado  | límites/lockout documentados aquí y en threat model        | respuesta adaptativa pendiente                    |
| `v5.0.0-6.1.3`  |   2 | Verificado  | visitante, demo y cuenta documentados; demo no es Identity | no hay IdP alternativo                            |
| `v5.0.0-6.2.1`  |   1 | Verificado  | mínimo 12                                                  | ASVS recomienda 15                                |
| `v5.0.0-6.2.2`  |   1 | Verificado  | endpoint/pantalla de cambio                                | pruebas finales                                   |
| `v5.0.0-6.2.3`  |   1 | Verificado  | exige contraseña actual y nueva                            | reauth adicional según riesgo                     |
| `v5.0.0-6.2.4`  |   1 | **Parcial** | `CommonPasswordPolicy` bloquea una lista pequeña           | ampliar a al menos 3000 coincidencias compatibles |
| `v5.0.0-6.2.5`  |   1 | Verificado  | sin reglas arbitrarias de composición                      | mantener compatibilidad con gestores              |
| `v5.0.0-6.2.7`  |   1 | Verificado  | formularios no impiden pegar/autocomplete                  | accesibilidad E2E                                 |
| `v5.0.0-6.2.8`  |   1 | Verificado  | no se trunca ni normaliza contraseña                       | límite máximo explícito 128                       |
| `v5.0.0-6.2.9`  |   2 | Verificado  | acepta hasta 128                                           | comprobar UI y DTO                                |
| `v5.0.0-6.2.12` |   2 | Parcial     | sin integración de breached passwords                      | integrar consulta k-anónima o dataset mantenido   |
| `v5.0.0-6.3.1`  |   1 | Parcial     | lockout y rate limit                                       | distribución/adaptive response pendientes         |
| `v5.0.0-6.3.2`  |   1 | Verificado  | no se crea admin/default account                           | no existe función admin                           |
| `v5.0.0-6.3.3`  |   2 | **Parcial** | solo email+contraseña                                      | MFA ausente; bloquea afirmación L2                |
| `v5.0.0-6.3.8`  |   3 | Parcial     | mensajes genéricos                                         | probar diferencias temporales                     |
| `v5.0.0-6.4.2`  |   1 | Verificado  | no hay preguntas secretas                                  | ninguna                                           |
| `v5.0.0-6.4.3`  |   2 | Parcial     | reset Identity, token corto/uso único lógico               | MFA inexistente y SMTP sin verificar              |

## V7. Sesiones

| ID             |   L | Estado     | Evidencia                                                       | Pendiente/riesgo                                  |
| -------------- | --: | ---------- | --------------------------------------------------------------- | ------------------------------------------------- |
| `v5.0.0-7.1.1` |   2 | Verificado | idle 30 min; absoluto 24 h/2 h; reauth 10 min                   | justificar tras análisis de uso real              |
| `v5.0.0-7.1.2` |   2 | Parcial    | sesiones múltiples permitidas y servidor las conserva           | UI para listar/límite explícito ausente           |
| `v5.0.0-7.2.1` |   1 | Verificado | validación en backend contra DB+stamp                           | tests de fallo DB                                 |
| `v5.0.0-7.2.2` |   1 | Verificado | sesiones de referencia dinámicas                                | framework genera tokens                           |
| `v5.0.0-7.2.3` |   1 | Verificado | generador seguro de Identity/cookie                             | evidencia depende del framework mantenido         |
| `v5.0.0-7.2.4` |   1 | Verificado | login y reauth revocan/crean una sesión con identificador nuevo | ejecución final de integración                    |
| `v5.0.0-7.3.1` |   2 | Verificado | timeout inactividad servidor                                    | reloj/proxy                                       |
| `v5.0.0-7.3.2` |   2 | Verificado | expiración absoluta servidor                                    | reloj/proxy                                       |
| `v5.0.0-7.4.1` |   1 | Verificado | logout/expiración revocan fila/cookie                           | tests concurrentes                                |
| `v5.0.0-7.4.2` |   1 | Verificado | eliminación borra sesiones                                      | prueba transaccional                              |
| `v5.0.0-7.4.3` |   2 | Parcial    | cambio/reset revoca sesiones según flujo                        | opción visible “cerrar otras sesiones” incompleta |
| `v5.0.0-7.4.4` |   2 | Verificado | logout visible en cuenta/app                                    | accesibilidad                                     |
| `v5.0.0-7.4.5` |   2 | N/A        | no hay administrador                                            | reevaluar si se añade                             |

## V8. Autorización

| ID             |   L | Estado     | Evidencia                                           | Pendiente/riesgo             |
| -------------- | --: | ---------- | --------------------------------------------------- | ---------------------------- |
| `v5.0.0-8.1.1` |   1 | Verificado | actores y endpoints en `DATA_FLOW_AND_ASSET_MAP.md` | actualizar por endpoint      |
| `v5.0.0-8.2.1` |   1 | Verificado | policies `Workspace` y `Registered`                 | tests finales                |
| `v5.0.0-8.2.2` |   1 | Verificado | workspace se deriva de sesión                       | tests A/B/demo               |
| `v5.0.0-8.2.3` |   2 | Verificado | DTOs mínimos; no retorna hash/token/campos Identity | revisión ante nuevos DTO     |
| `v5.0.0-8.3.1` |   1 | Verificado | control servidor, guard React no es autoridad       | ninguna decisión en cliente  |
| `v5.0.0-8.4.1` |   2 | Verificado | workspaces aíslan cuenta/demo                       | PostgreSQL constraints/tests |
| `v5.0.0-8.4.2` |   3 | N/A        | sin interfaz administrativa                         | MFA/modelo nuevo si se crea  |

## V9–V10. Tokens autocontenidos y OAuth/OIDC

| ID              |   L | Estado | Evidencia                                 | Pendiente/riesgo          |
| --------------- | --: | ------ | ----------------------------------------- | ------------------------- |
| `v5.0.0-9.1.1`  |   1 | N/A    | no se usan JWT/access tokens en navegador | reevaluar si cambia auth  |
| `v5.0.0-10.1.1` |   2 | N/A    | no hay OAuth/OIDC                         | reevaluar al integrar IdP |

## V11. Criptografía

| ID              |   L | Estado     | Evidencia                                                       | Pendiente/riesgo                          |
| --------------- | --: | ---------- | --------------------------------------------------------------- | ----------------------------------------- |
| `v5.0.0-11.1.1` |   2 | Parcial    | keyring/certificado/rotación documentados                       | política proveedor y custodios pendientes |
| `v5.0.0-11.1.2` |   2 | Parcial    | inventario en docs: Identity PBKDF2, DP X.509, TLS              | completar algoritmo/certificado real      |
| `v5.0.0-11.2.1` |   2 | Verificado | Identity/Data Protection, sin criptografía propia               | mantener frameworks                       |
| `v5.0.0-11.4.2` |   2 | Verificado | PBKDF2 IdentityV3 con 210 000 iteraciones                       | benchmark/revisión periódica              |
| `v5.0.0-11.5.1` |   2 | Verificado | tokens/sesiones generados por APIs criptográficas del framework | no usar UUID como secreto                 |

## V12. Comunicaciones seguras

| ID              |   L | Estado  | Evidencia                                 | Pendiente/riesgo                                  |
| --------------- | --: | ------- | ----------------------------------------- | ------------------------------------------------- |
| `v5.0.0-12.1.1` |   1 | Parcial | HSTS/HTTPS en app                         | TLS 1.2/1.3 debe fijarlo/verificarlo el proveedor |
| `v5.0.0-12.2.1` |   1 | Parcial | producción exige URLs HTTPS               | dominio/certificado no configurados               |
| `v5.0.0-12.2.2` |   1 | Parcial | checklist requiere CA pública             | certificado no verificable                        |
| `v5.0.0-12.3.1` |   2 | Parcial | documentación exige TLS a DB/SMTP/YouTube | Compose local usa conexión local sin TLS          |

## V13. Configuración

| ID              |   L | Estado     | Evidencia                                                        | Pendiente/riesgo                                              |
| --------------- | --: | ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| `v5.0.0-13.1.1` |   2 | Verificado | servicios/flujos documentados                                    | actualizar con proveedor                                      |
| `v5.0.0-13.1.4` |   3 | Parcial    | inventario de secretos y rotación por incidente                  | calendario definitivo pendiente                               |
| `v5.0.0-13.2.2` |   2 | Parcial    | se pide cuenta DB de aplicación                                  | privilegios reales no verificables                            |
| `v5.0.0-13.2.3` |   2 | Verificado | Compose exige contraseña y no tiene fallback                     | antigua credencial histórica debe rotarse si se reutilizó     |
| `v5.0.0-13.2.4` |   2 | Parcial    | código limita destinos a SMTP/YouTube y valida las URLs de vídeo | firewall/allowlist egress no verificable desde el repositorio |
| `v5.0.0-13.3.1` |   2 | Parcial    | env/User Secrets, validación y Gitleaks local/CI                 | gestor de secretos de producción pendiente                    |
| `v5.0.0-13.4.1` |   1 | Parcial    | deployment checklist prohíbe `.git`                              | artefacto real no construido                                  |
| `v5.0.0-13.4.2` |   2 | Parcial    | OpenAPI solo Development y errores genéricos                     | ejecutar bajo `Production`                                    |
| `v5.0.0-13.4.5` |   2 | Verificado | health DB deshabilitado por defecto; OpenAPI dev                 | monitor privado pendiente                                     |

## V14. Protección de datos

| ID              |   L | Estado     | Evidencia                                                    | Pendiente/riesgo                                     |
| --------------- | --: | ---------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| `v5.0.0-14.1.1` |   2 | Verificado | clasificación en `DATA_FLOW_AND_ASSET_MAP.md`                | validación jurídica                                  |
| `v5.0.0-14.1.2` |   2 | Parcial    | retención, logs, backup y acceso documentados                | plazos/proveedor definitivos                         |
| `v5.0.0-14.2.1` |   1 | Verificado | secretos reset/confirm en fragmento/cuerpo, no query backend | prueba E2E                                           |
| `v5.0.0-14.2.2` |   2 | Parcial    | API/auth no-store y caché memoria solo metadatos             | CDN/proxy real                                       |
| `v5.0.0-14.2.3` |   2 | Verificado | no analítica/tracking; solo servicios declarados             | revisar dependencias futuras                         |
| `v5.0.0-14.2.7` |   3 | Parcial    | demo se purga; cuenta se elimina                             | logs/backups tienen borrado diferido por definir     |
| `v5.0.0-14.3.1` |   1 | Verificado | purga IndexedDB scoped en logout/delete/cambio identidad     | cierre abrupto                                       |
| `v5.0.0-14.3.2` |   2 | Parcial    | `_headers` no-store                                          | proveedor puede ignorarlo                            |
| `v5.0.0-14.3.3` |   2 | Parcial    | IndexedDB contiene datos personales por diseño local-first   | riesgo aceptado; sin cifrado local ni backup binario |

## V15. Arquitectura y supply chain

| ID              |   L | Estado     | Evidencia                                                                                | Pendiente/riesgo                                      |
| --------------- | --: | ---------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `v5.0.0-15.1.1` |   1 | Parcial    | Dependabot/auditoría y severidades documentadas                                          | SLA de actualización debe aplicarse                   |
| `v5.0.0-15.1.2` |   2 | Parcial    | lockfiles/inventario; CodeQL                                                             | SBOM formal no generado                               |
| `v5.0.0-15.2.1` |   1 | Parcial    | auditorías npm y NuGet finales sin avisos; comprobaciones recurrentes configuradas en CI | workflow GitHub aún sin ejecución; advisories futuras |
| `v5.0.0-15.2.2` |   2 | Parcial    | límites snapshot/YouTube/auth                                                            | carga y multiinstancia pendientes                     |
| `v5.0.0-15.2.3` |   2 | Parcial    | OpenAPI solo desarrollo                                                                  | artefacto Production debe inspeccionarse              |
| `v5.0.0-15.2.4` |   3 | Parcial    | locks, integridad npm, feeds oficiales                                                   | allowlist de feed/SBOM/provenance pendiente           |
| `v5.0.0-15.3.3` |   2 | Verificado | DTOs explícitos y JSON strict                                                            | mantener al añadir campos                             |
| `v5.0.0-15.3.4` |   2 | Parcial    | proxies explícitamente confiables                                                        | prueba real de spoofing pendiente                     |
| `v5.0.0-15.3.6` |   2 | Verificado | claves prototipo prohibidas en snapshot/import                                           | fuzzing pendiente                                     |

## V16. Logging y errores

| ID              |   L | Estado     | Evidencia                                            | Pendiente/riesgo                                  |
| --------------- | --: | ---------- | ---------------------------------------------------- | ------------------------------------------------- |
| `v5.0.0-16.1.1` |   2 | Parcial    | eventos y restricciones documentados                 | sink, acceso y retención definitivos              |
| `v5.0.0-16.2.1` |   2 | Verificado | eventos contienen tipo/actor/fecha/resultado mínimos | correlación distribuida pendiente                 |
| `v5.0.0-16.2.2` |   2 | Parcial    | timestamps UTC en entidades                          | sincronización NTP del proveedor                  |
| `v5.0.0-16.2.5` |   2 | Verificado | auditoría evita cuerpo/email/token/cookie            | validar configuración Serilog futura              |
| `v5.0.0-16.3.1` |   2 | Verificado | eventos login/recuperación/cambios                   | alertas de anomalía pendientes                    |
| `v5.0.0-16.3.2` |   2 | Parcial    | fallos relevantes auditables                         | cobertura total de autorización a probar          |
| `v5.0.0-16.4.2` |   2 | Parcial    | tabla DB separada                                    | inmutabilidad/export a sistema separado pendiente |
| `v5.0.0-16.4.3` |   2 | Parcial    | procedimiento exige sink separado                    | no configurado                                    |
| `v5.0.0-16.5.1` |   2 | Verificado | ProblemDetails y handler genérico                    | prueba Production                                 |
| `v5.0.0-16.5.3` |   2 | Verificado | sesiones/validación fallan cerradas                  | caos DB/SMTP pendiente                            |
| `v5.0.0-16.5.4` |   3 | Verificado | handler global de excepciones                        | observabilidad real                               |

## V17. WebRTC

Todos los controles V17 son **N/A**: MIGA usa captura/reproducción local, no WebRTC, TURN, media
server ni signaling.

## Acciones que bloquean L2

1. MFA o combinación equivalente (`v5.0.0-6.3.3`).
2. Lista de al menos 3000 contraseñas comunes (`v5.0.0-6.2.4`) y evaluación de breached passwords.
3. Gestión y listado de sesiones (`v5.0.0-7.1.2`, `7.4.3`, `7.5.2`).
4. Validación dinámica de TLS, cookies, headers, proxy y CSP.
5. Gestor de secretos, backup/restore y logging separados reales.
6. Resolver o aceptar formalmente datos personales/blobs en IndexedDB.
7. Ejecutar CI y pruebas de autorización, no solo tenerlas configuradas.
