# Checklist de despliegue seguro

Fecha: 23 de julio de 2026.

No despliegues MIGA en producción hasta completar y evidenciar los puntos aplicables. Una casilla sin
marcar es un bloqueo o un riesgo aceptado por escrito, no una tarea implícitamente resuelta.

## 1. Gobierno y release

- [ ] Existe propietario del servicio, seguridad, datos, backup y guardia de incidentes.
- [ ] El commit a desplegar está revisado y asociado a un release/tag.
- [ ] `Security CI` ha terminado correctamente para ese commit.
- [ ] Los checks requeridos protegen `main`; no basta con tener el workflow.
- [ ] No se usa `pull_request_target` para ejecutar código de PR con secretos.
- [ ] Actions están fijadas a SHA completo y Dependabot las actualiza.
- [ ] Gitleaks y CodeQL han producido resultado válido; no solo están configurados.
- [ ] npm, NuGet e imagen no tienen Critical/High sin excepción aprobada, alcance y caducidad.
- [ ] La versión y el SHA-256 del binario Trivy se contrastan con la release oficial al actualizarlo.
- [ ] El artefacto se construyó una vez y se promueve por digest; no se recompila en producción.
- [ ] Existe SBOM/inventario del release y retención de los artefactos anterior/actual.

## 2. Artefactos

- [ ] El bundle frontend no contiene `.env`, sourcemaps públicos no aprobados ni claves.
- [ ] El publish backend no contiene `.git`, User Secrets, certificados, dumps, logs ni appsettings
      locales.
- [ ] Los artefactos se escanearon buscando secretos después de construir.
- [ ] Los hashes/digests están registrados.
- [ ] La imagen usa usuario no root cuando se cree un Dockerfile de aplicación.
- [ ] Imágenes base están fijadas por digest y escaneadas.
- [ ] Los permisos del registro impiden sobrescribir tags de release.

## 3. Secretos y configuración

- [ ] `ConnectionStrings__MigaDatabase` procede del gestor de secretos.
- [ ] `POSTGRES_PASSWORD` no es el valor histórico/dev ni está reutilizado.
- [ ] Si el valor histórico se reutilizó, fue rotado y sus accesos revisados.
- [ ] `Smtp__Password` y `YouTubeApi__ApiKey` están en el gestor y restringidos.
- [ ] `DataProtection__CertificatePassword` está separado del certificado.
- [ ] Ningún secreto aparece en variables `VITE_*`; todo `VITE_*` es público.
- [ ] El runtime tiene acceso de lectura solo a los secretos necesarios.
- [ ] Existe calendario de rotación y responsable.
- [ ] Logs, tracing, crash dumps y health no imprimen configuración ni valores.
- [ ] Producción falla ante valores vacíos, HTTP, localhost o marcadores de ejemplo.

## 4. Dominio, HTTPS y proxy

- [ ] Existe dominio definitivo y certificado de CA pública.
- [ ] Solo TLS 1.2/1.3 y cipher suites recomendadas.
- [ ] HTTP redirige a HTTPS sin aceptar credenciales por HTTP.
- [ ] HSTS tiene duración aprobada; `includeSubDomains`/preload solo tras verificar todos los
      subdominios.
- [ ] Frontend y API usan el mismo origen, con `/api` por reverse proxy y `VITE_API_URL=/`.
- [ ] El proxy preserva `Host` o `AllowedHosts` declara exactamente el host efectivo recibido por
      ASP.NET Core.
- [ ] `Authentication__PublicBaseUrl` es exactamente el origen HTTPS público.
- [ ] `AllowedHosts` contiene solo el host productivo efectivo.
- [ ] `Cors__AllowedOrigins__*` contiene orígenes HTTPS exactos, sin `*`.
- [ ] CORS permite credenciales solo a esos orígenes.
- [ ] El proxy elimina `Forwarded`, `X-Forwarded-*` y `X-Real-IP` del cliente.
- [ ] `TrustedProxies__Addresses__*` solo contiene IPs/CIDR controlados.
- [ ] `TrustedProxies__ForwardLimit` refleja exactamente la cadena.
- [ ] Prueba de IP spoofing confirma que rate limit/log usan el origen esperado.
- [ ] Tamaño máximo de request y timeouts están limitados en proxy y Kestrel.
- [ ] TRACE y métodos no usados están bloqueados.

## 5. Cookies, CSRF y navegador

- [ ] Cookies productivas tienen nombre `__Host-`, `Secure`, `HttpOnly`, `Path=/`, sin `Domain`.
- [ ] `SameSite=Lax` sigue siendo adecuado para la topología final.
- [ ] Cada mutación rechaza token CSRF ausente/incorrecto.
- [ ] Logout, expiración y revocación inutilizan la sesión servidor.
- [ ] CSP real incluye `object-src 'none'`, `base-uri 'none'` y `frame-ancestors`.
- [ ] CSP permite solo recursos necesarios de MIGA/YouTube/blob; no `unsafe-eval`.
- [ ] La carga del IFrame API/player de YouTube está aceptada, documentada en privacidad y no se
      amplía a otros scripts de terceros.
- [ ] `nosniff`, Referrer-Policy, Permissions-Policy y COOP aparecen en respuestas reales.
- [ ] API/auth/snapshot/export devuelven `Cache-Control: no-store`.
- [ ] CDN no cachea respuestas con cookie ni `Set-Cookie`.
- [ ] `/api` es NetworkOnly en service worker.
- [ ] `index.html` y service worker se revalidan; assets con hash son `immutable`.
- [ ] Actualización PWA no interrumpe una sesión/examen y rollback conserva assets previos.

## 6. PostgreSQL

- [ ] PostgreSQL no tiene puerto público.
- [ ] La aplicación usa rol propio, sin superuser/createdb/createrole.
- [ ] TLS y validación de certificado están activos entre app y DB.
- [ ] Security groups/firewall solo permiten la aplicación y administración controlada.
- [ ] Cifrado en reposo del proveedor está verificado con evidencia.
- [ ] Pools, conexiones, timeouts y almacenamiento tienen límites/alertas.
- [ ] Zona horaria/reloj son coherentes; auditoría usa UTC.
- [ ] Backups/PITR están activos y separados del runtime.
- [ ] El último restore test cumple RPO/RTO.

## 7. Data Protection

- [ ] Keyring persiste en PostgreSQL.
- [ ] Existe certificado X.509 productivo específico con clave privada exportable/recuperable según
      política.
- [ ] Certificado montado read-only fuera de imagen/repositorio.
- [ ] Permisos permiten solo al proceso API.
- [ ] La versión anterior se conserva durante la rotación si no está comprometida.
- [ ] Backup separado del certificado/clave privada está cifrado y probado.
- [ ] Reinicio de todas las réplicas conserva sesiones/tokens compatibles.
- [ ] Restaurar DB+keyring+certificado se probó en entorno aislado.

## 8. SMTP y correo

- [ ] Se eligió proveedor y se revisó tratamiento de datos.
- [ ] `Smtp__Enabled=true` solo con host, puerto, TLS, usuario, contraseña y remitente válidos.
- [ ] Si `RequireConfirmedEmail=true`, startup y envío sandbox pasan.
- [ ] SPF, DKIM y DMARC están configurados.
- [ ] Límites/cuotas y alertas evitan spam/agotamiento.
- [ ] Enlaces usan `PublicBaseUrl`, HTTPS y token en fragmento.
- [ ] Logs no contienen email completo, cuerpo ni token.
- [ ] Respuestas forgot/resend son genéricas.
- [ ] Existe fallback operativo si SMTP cae, sin desactivar seguridad silenciosamente.

## 9. Migraciones

- [ ] `dotnet tool restore` usa el manifest versionado.
- [ ] Restore NuGet es `--locked-mode`.
- [ ] La migración está versionada y revisada.
- [ ] `has-pending-model-changes` no detecta drift entre modelo y snapshot.
- [ ] CI genera un script idempotente sin conectarse a producción.
- [ ] El SQL idempotente y su checksum proceden del mismo commit desplegado.
- [ ] El script no contiene secretos, datos de aplicación ni seeds personales.
- [ ] Se probó contra base vacía.
- [ ] Se probó desde la versión productiva anterior con volumen de datos representativo.
- [ ] Constraints únicas/FK/índices y reglas de borrado están revisadas.
- [ ] Existe backup/restore point justo antes.
- [ ] Migraciones largas tienen plan online/ventana y observación.
- [ ] Se usa expand/migrate/contract para cambios incompatibles.
- [ ] La aplicación no ejecuta migraciones automáticamente al arrancar producción.

## 10. Rollback

- [ ] Se conserva el artefacto anterior por digest.
- [ ] La versión anterior es compatible con el esquema nuevo.
- [ ] Existe una versión mínima compatible de IndexedDB/snapshot.
- [ ] Un rollback de frontend no abrirá una DB Dexie con versión incompatible.
- [ ] Rollback de app no ejecuta down migration automática.
- [ ] Restaurar DB es decisión de incidente y considera datos posteriores al restore point.
- [ ] Feature flag/modo mantenimiento permite contener sin destruir datos.
- [ ] Se probó rollback en staging y se midió.

Orden normal:

1. detener promoción;
2. desactivar feature/escrituras afectadas;
3. volver al artefacto compatible;
4. validar health/login/snapshot;
5. restaurar datos solo si existe corrupción y con procedimiento de backup;
6. conservar evidencia.

## 11. Rate limit, caché y tareas distribuidas

- [ ] Una sola réplica está declarada, **o** se sustituyó el estado en memoria.
- [ ] Para varias réplicas, auth/demo/snapshot/YouTube usan Redis o gateway compartido.
- [ ] IP y cuenta/sesión forman claves apropiadas; no se confía ciegamente en headers.
- [ ] Lockout no permite bloquear indefinidamente a una víctima.
- [ ] La caché YouTube tiene límites, TTL y estrategia distribuida/invalidation.
- [ ] Cleanup demo tiene líder/lock distribuido o SQL idempotente seguro.
- [ ] Métricas alertan por 429, lockout, demos, SMTP, cuota YouTube y tamaño snapshot.
- [ ] Rate limiting de infraestructura protege antes de Kestrel.

El estado actual en memoria solo es aceptable para una instancia. Escalar sin resolverlo es un
bloqueo de seguridad y coste.

## 12. Demo

- [ ] Entrada visible “Probar MIGA” sin datos personales.
- [ ] Banner indica demo/caducidad y datos ficticios.
- [ ] La cookie demo no autentica como registrado.
- [ ] No hay efectos externos reales desde demo.
- [ ] 5 creaciones/h/IP y 256 KiB de snapshot funcionan.
- [ ] Caducidad idle/absoluta y cleanup se probaron.
- [ ] Cleanup borra solo `WorkspaceKind.Demo`.
- [ ] Conversión exige consentimiento `importDemoData`.
- [ ] Conversión ajena/doble falla.
- [ ] Demo no accede a YouTube registrado, export/delete ni futuras funciones admin.

## 13. Privacidad y legal

- [ ] Identidad y datos de contacto del responsable están definidos.
- [ ] Finalidades, base jurídica, destinatarios y transferencias están revisados.
- [ ] Plazos de cuenta, demo, logs, auditoría y backups están decididos.
- [ ] El texto deja claro que blobs solo viven en el dispositivo.
- [ ] Exportación contiene solo datos propios y no promete incluir blobs.
- [ ] Eliminación borra cuenta/workspace/sesiones y explica retención diferida de backups/auditoría.
- [ ] Política y consentimiento tienen versión.
- [ ] Los textos ES/EN/VA recibieron revisión jurídica.
- [ ] Se evita afirmar cumplimiento pleno del RGPD.
- [ ] DPA/contratos con hosting, SMTP y backups están revisados.
- [ ] Procedimiento para derechos y brechas tiene responsable/plazos.

Mientras la UI diga “Pendiente de revisión jurídica”, producción pública con cuentas reales requiere
una aceptación expresa del propietario y asesoría.

## 14. Logging y observabilidad

- [ ] Sink estructurado separado del runtime.
- [ ] Acceso mínimo, transporte cifrado e inmutabilidad/retención.
- [ ] No se registran password, token, cookie, Authorization, body, email completo ni snapshot.
- [ ] Se registran login, recovery, cambios, revocación, export/delete y anomalías.
- [ ] Alertas tienen responsable y canal probado.
- [ ] Correlation ID no incluye datos personales.
- [ ] Relojes sincronizados y UTC.
- [ ] Excepciones al cliente son genéricas en `Production`.
- [ ] OpenAPI/debug/health DB no están públicos.

## 15. Backups y recuperación

- [ ] PITR/snapshots/retención están configurados.
- [ ] Backup y KMS están separados de credenciales runtime.
- [ ] Restore test aislado documentado y dentro de RPO/RTO.
- [ ] Keyring y certificado se restauran correctamente.
- [ ] Cuenta sintética verifica aislamiento.
- [ ] Se sabe que blobs local-only no son recuperables.
- [ ] El runbook de corrupción, borrado y compromiso está accesible.

## 16. Smoke tests posteriores

- [ ] `/api/health` responde mínimo.
- [ ] `/api/health/db` no es público salvo decisión.
- [ ] origen CORS ajeno es rechazado.
- [ ] cookies tienen flags correctos.
- [ ] CSRF inválido falla.
- [ ] registro/login/logout/recuperación sandbox funcionan.
- [ ] demo está aislada.
- [ ] usuario A no lee/escribe/exporta/elimina B.
- [ ] snapshot inválido/oversize/obsoleto falla.
- [ ] export/delete requieren reauth.
- [ ] headers/caché/SW verificados desde Internet.
- [ ] logs y artefactos no muestran secretos.
- [ ] métricas y alertas reciben un evento sintético.

## 17. Criterios de abortar

Abortar o revertir si:

- aparece un secreto en artefacto/log;
- falla migración/restore o no hay backup válido;
- CORS/hosts/proxy aceptan origen/IP no autorizado;
- cookies no son Secure/HttpOnly;
- tests de aislamiento fallan;
- frontend/backend no son compatibles con esquema/snapshot;
- SMTP expone token o enumera usuarios;
- CI Critical/High no tiene excepción aprobada;
- no hay responsable para incidentes;
- el despliegue exige datos reales para probar.
