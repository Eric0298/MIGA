# Respuesta a incidentes

Fecha: 23 de julio de 2026.

Este runbook debe adaptarse al proveedor y probarse antes de producción. No sustituye asesoramiento
legal ni forense. Los contactos, suplentes y canales seguros todavía deben asignarse.

## 1. Principios

1. proteger a las personas y contener antes que preservar disponibilidad;
2. revocar un secreto antes de intentar ocultarlo del repositorio;
3. conservar evidencia de forma íntegra, con acceso mínimo;
4. no borrar logs, reconstruir producción ni reescribir Git durante la investigación inicial;
5. no copiar datos personales a chats, issues o tickets públicos;
6. documentar horas en UTC, decisiones, responsable y evidencia;
7. recuperar con un artefacto conocido y un backup probado;
8. comunicar hechos confirmados y separar claramente hipótesis.

## 2. Roles a asignar

| Rol                     | Responsabilidad                                      |
| ----------------------- | ---------------------------------------------------- |
| Incident commander      | prioridad, decisiones, cronología y cierre           |
| Responsable técnico     | contención, análisis y recuperación                  |
| Custodio de secretos    | revocación, KMS/vault/certificados                   |
| Responsable de datos    | alcance de datos y restauración                      |
| Comunicación/legal      | usuarios, proveedor, autoridades y revisión jurídica |
| Secretario de evidencia | hashes, copias, cadena de custodia                   |

En un proyecto unipersonal, una persona puede asumir varios roles, pero debe registrar cuándo cambia
de función y pedir apoyo externo para incidentes graves.

## 3. Severidad

| Nivel         | Ejemplos                                                       | Acción                                             |
| ------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| SEV-1 Crítica | exfiltración activa, secreto prod, toma masiva, pérdida total  | respuesta inmediata, detener exposición/escrituras |
| SEV-2 Alta    | una cuenta tomada, auth bypass, dependencia crítica alcanzable | contención el mismo día                            |
| SEV-3 Media   | abuso limitado, fuga técnica sin datos, degradación            | investigar y corregir priorizado                   |
| SEV-4 Baja    | intento bloqueado o mejora preventiva                          | backlog con fecha                                  |

## 4. Activación y primeros 60 minutos

1. abrir un registro privado con ID, hora UTC y fuente;
2. nombrar incident commander;
3. clasificar provisionalmente;
4. no ejecutar payloads sobre producción;
5. capturar versión/digest, configuración redactada, alertas, eventos y ventana temporal;
6. preservar logs en almacenamiento separado y de solo anexado;
7. contener el vector: revocar, aislar endpoint, retirar release o modo mantenimiento;
8. evaluar si hay datos personales, cuentas o backups afectados;
9. avisar a proveedor/legal si el contrato o normativa lo exige;
10. fijar siguiente actualización.

## 5. Conservación de evidencia

Conservar:

- logs de proxy, aplicación, base, proveedor, GitHub y gestor de secretos;
- `audit.security_events`;
- IDs de sesión/evento, nunca cookies o tokens completos;
- commit, imagen, SBOM/locks y artefacto desplegado;
- snapshot forense de base/volumen antes de corregir corrupción;
- cabeceras/respuestas redactadas;
- timeline UTC.

Para cada archivo:

```text
ID de evidencia:
Origen:
Fecha/hora UTC:
Recolector:
SHA-256:
Ubicación cifrada:
Personas con acceso:
Transformaciones/redacciones:
```

No almacenar contraseñas, tokens completos, cuerpos personales ni clave privada junto al informe.
Una copia forense debe tener retención y autorización explícitas.

## 6. Playbooks

### 6.1 Filtración de credenciales o secreto versionado

1. identificar tipo, entorno, privilegios y última rotación sin pegar el valor;
2. revocar/rotar en el proveedor;
3. buscar uso anómalo desde su creación;
4. sustituir por referencia a vault/env y desplegar;
5. invalidar artefactos/caches/logs que lo contengan;
6. escanear historial, forks y CI;
7. valorar reescritura Git solo después de rotar y con coordinación;
8. crear credencial nueva con menos privilegios;
9. registrar causa y prevención.

La antigua contraseña PostgreSQL dev está en el historial. Si se reutilizó, rotarla; no reescribir
el historial de forma automática.

### 6.2 Robo de cuenta

1. bloquear/revocar todas las sesiones del usuario;
2. bloquear temporalmente credenciales si continúa el abuso;
3. conservar eventos de login, cambios, export/delete y recuperación;
4. verificar cambio de email/contraseña y acciones realizadas;
5. forzar reset seguro por canal verificado;
6. restaurar datos solo desde copia aislada y tras validar propiedad;
7. notificar sin revelar señales antifraude;
8. investigar credential stuffing y ampliar bloqueo/rate limit.

No existe MFA; debe considerarse factor agravante.

### 6.3 Exposición de cookies/tokens o keyring

1. revocar filas de sesión afectadas;
2. si el alcance es incierto, revocar todas;
3. rotar claves Data Protection/certificado según alcance;
4. conservar la clave anterior solo si no está comprometida y se necesita descifrado;
5. revisar logs, backups y artefactos;
6. desplegar y verificar que sesiones antiguas fallan cerradas.

Rotar Data Protection puede invalidar confirmaciones/reset y sesiones; planificar comunicación.

### 6.4 Vulnerabilidad crítica

1. confirmar en entorno aislado;
2. deshabilitar ruta/feature o aplicar WAF temporal;
3. crear parche mínimo y test de regresión;
4. revisar el mismo patrón en todo el repositorio;
5. ejecutar CI, CodeQL, auditorías y smoke;
6. desplegar por entorno protegido;
7. buscar explotación previa;
8. coordinar divulgación y CVE/advisory si procede.

No publicar instrucciones explotables antes de contener.

### 6.5 Acceso no autorizado / IDOR

1. bloquear endpoint o política afectada;
2. preservar actor, workspace, recurso y ventana;
3. determinar lectura, escritura, exportación o borrado;
4. buscar otros recursos con el mismo patrón;
5. corregir autorización en servidor;
6. añadir tests usuario A/B, demo y anónimo;
7. evaluar notificación por datos personales;
8. restaurar selectivamente sin sobrescribir cambios legítimos.

### 6.6 Pérdida de datos

1. detener escrituras si aumentan la pérdida;
2. separar PostgreSQL de blobs local-only;
3. determinar último restore point válido;
4. restaurar primero en entorno aislado;
5. medir RPO real y comparar revisiones;
6. recuperar granularmente cuando sea posible;
7. comunicar claramente qué blobs nunca llegaron al servidor;
8. documentar causa y mejorar backup.

### 6.7 Corrupción de base de datos

1. activar modo mantenimiento;
2. preservar snapshot corrupto;
3. detener migración/job sospechoso;
4. identificar inicio de corrupción;
5. restaurar PITR en base aislada;
6. validar constraints, ownership, keyring y snapshots;
7. iniciar artefacto compatible;
8. reabrir solo tras pruebas;
9. no ejecutar down migration/destrucción improvisada.

### 6.8 Dependencia o imagen comprometida

1. congelar deploys;
2. localizar versiones y transitivas mediante locks/SBOM;
3. revisar cuándo entró y qué jobs/secretos alcanzó;
4. rotar credenciales de CI si código no confiable pudo ejecutarse;
5. actualizar/eliminar, regenerar lock y reconstruir desde runner limpio;
6. verificar checksum/digest, tests, CodeQL y secret scan;
7. revocar artefactos anteriores;
8. reactivar Dependabot y documentar excepción temporal.

### 6.9 Compromiso de GitHub Actions

1. deshabilitar workflow/deploy;
2. revocar tokens, OIDC trust y environment secrets alcanzables;
3. revisar Actions, SHAs, logs y artefactos;
4. invalidar releases creadas;
5. restaurar workflow desde commit conocido;
6. evitar ejecutar PR no confiable con secretos;
7. reconstruir y firmar/promover artefactos nuevos.

### 6.10 Abuso de demo o denegación de servicio

1. medir origen, endpoints, coste DB/SMTP/YouTube;
2. reducir temporalmente límites o deshabilitar demo;
3. no bloquear permanentemente una IP compartida sin revisión;
4. mover límites a gateway/Redis si hay varias instancias;
5. limpiar demos expiradas con filtro `Demo`;
6. verificar que cuentas reales no se borraron;
7. añadir challenge solo si el abuso lo justifica.

### 6.11 Exposición de backup

1. revocar acceso al objeto/cuenta;
2. preservar logs de acceso;
3. identificar fecha, cifrado y datos incluidos;
4. rotar credenciales/keyring/certificado si estaban expuestos;
5. evaluar usuarios y ventanas afectadas;
6. eliminar copias no autorizadas cuando sea legal/posible;
7. revisar separación de cuenta, KMS e inmutabilidad;
8. generar copia limpia tras contención.

## 7. Revocación de sesiones

Orden recomendado:

1. cuenta concreta, si el alcance es seguro;
2. todas las sesiones del entorno, si hay robo de keyring/cookie general o alcance incierto;
3. borrar cookies desde respuesta y filas servidor;
4. rotar security stamp/credencial cuando aplique;
5. confirmar que un request con sesión antigua recibe rechazo;
6. registrar motivo sin token.

Demo y cuenta usan stores/cookies diferentes: revocar ambos solo si corresponde.

## 8. Rotación de claves

Inventario mínimo:

- contraseña/cuenta PostgreSQL;
- certificado Data Protection y su contraseña;
- credenciales SMTP;
- API key YouTube;
- credenciales de backup/KMS;
- secretos del hosting/GitHub.

Para cada rotación:

1. crear nueva versión con mínimo privilegio;
2. desplegar consumidor compatible;
3. verificar lectura/escritura;
4. revocar antigua;
5. revisar uso anómalo;
6. actualizar runbook y fecha;
7. nunca registrar valores.

La rotación del certificado Data Protection requiere solapamiento si debe seguir descifrando claves
antiguas. Si está comprometido, prima revocación aunque cierre sesiones.

## 9. Comunicación y alcance

Comunicar solo:

- hechos confirmados;
- datos/usuarios/periodo afectados;
- acciones tomadas;
- pasos concretos para usuarios;
- próxima actualización.

Evitar:

- secretos, IDs innecesarios o técnicas que faciliten explotación;
- afirmar “sin impacto” sin evidencia;
- afirmar cumplimiento legal;
- prometer recuperación de blobs nunca sincronizados.

La persona responsable de privacidad debe valorar obligaciones y plazos con asesoría jurídica. Los
textos actuales están pendientes de revisión legal.

## 10. Recuperación y cierre

Antes de cerrar:

- vector contenido;
- secreto/sesiones revocados;
- parche probado y desplegado;
- datos restaurados o pérdida documentada;
- monitorización reforzada;
- usuarios/proveedores informados cuando corresponda;
- evidencia protegida;
- postmortem sin culpabilización;
- acciones con propietario y fecha.

Postmortem:

```text
Resumen:
Impacto:
Línea temporal UTC:
Causa raíz:
Controles que funcionaron/fallaron:
Datos afectados:
Recuperación y RPO/RTO:
Acciones, propietario y fecha:
Riesgo residual:
```

El canal de recepción externo se define en [SECURITY.md](../../SECURITY.md).
