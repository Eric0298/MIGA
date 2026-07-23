# Copias de seguridad y recuperación

Fecha: 23 de julio de 2026.

Los objetivos de este documento son **propuestos**, no un SLA ni evidencia de que un proveedor ya
los cumpla. Una copia que nunca se ha restaurado no se considera verificada.

## 1. Alcance real

### Cubierto por PostgreSQL

- usuarios y relaciones ASP.NET Core Identity;
- sesiones servidor;
- workspaces demo/registrados;
- snapshots JSON estructurados;
- eventos de seguridad;
- keyring ASP.NET Core Data Protection.

### No cubierto

Los stores de blobs de IndexedDB:

- PDF y vídeos subidos;
- notas de voz;
- imágenes y documentos;
- imágenes/audio de preguntas.

Esos bytes no se envían en el snapshot API, no aparecen en el export JSON/de cuenta y no pueden
recuperarse desde PostgreSQL. El usuario debe conservar los originales. No debe presentarse un
backup servidor como copia completa de MIGA mientras esta decisión siga vigente.

También quedan fuera del dump:

- secretos del gestor;
- clave privada/certificado que protege Data Protection;
- configuración del proxy/CDN;
- imágenes de contenedor y artefactos de aplicación, que deben conservarse por digest/commit.

## 2. Objetivos propuestos

| Entorno/activo                  |                                        RPO |              RTO | Justificación                                                    |
| ------------------------------- | -----------------------------------------: | ---------------: | ---------------------------------------------------------------- |
| PostgreSQL producción           |                                     15 min |              4 h | PITR/WAL y restore gestionado                                    |
| Keyring + certificado protector | 24 h tras cambio; copia inmediata al rotar |              4 h | sin ambos, cookies/tokens protegidos pueden quedar inutilizables |
| Artefactos aplicación           |                   0 para versión publicada |              1 h | artefacto inmutable ya construido                                |
| Configuración no secreta        |                              commit actual |              1 h | Git                                                              |
| Blobs locales                   |                           sin RPO servidor | sin RTO servidor | no están sincronizados                                           |

Si el propietario no puede financiar PITR, debe declarar un RPO diario y aceptar explícitamente la
pérdida máxima de 24 horas. No se debe prometer 15 minutos usando solo snapshots diarios.

## 3. Estrategia propuesta

### PostgreSQL

1. PITR continuo mediante WAL del proveedor.
2. Snapshot/dump diario cifrado.
3. Copia semanal independiente.
4. Copia mensual de largo plazo.
5. Backup antes de cada migración con riesgo de datos.
6. Copia en cuenta/proyecto distinto del runtime, con acceso de mínimo privilegio.
7. protección frente a borrado mediante inmutabilidad/object lock cuando el proveedor lo permita.

Retención inicial a validar legalmente:

| Tipo          |                                    Retención |
| ------------- | -------------------------------------------: |
| PITR/WAL      |                                       7 días |
| Diario        |                                      30 días |
| Semanal       |                                   12 semanas |
| Mensual       |                                     12 meses |
| Pre-migración | hasta dos releases estables y mínimo 30 días |

La retención debe alinearse con eliminación de cuenta, obligaciones legales y capacidad. Los
backups pueden conservar temporalmente datos eliminados; el acceso debe estar restringido y esos
datos no deben reingresarse al servicio salvo una restauración justificada.

### Cifrado

- verificar y registrar que volúmenes, snapshots y objetos están cifrados en reposo por el
  proveedor;
- usar clave KMS dedicada y rotación definida;
- TLS entre aplicación y PostgreSQL en producción;
- cifrar cualquier copia exportada fuera del proveedor;
- separar permisos de datos, backups y claves;
- no afirmar “cifrado en reposo” hasta verificar configuración y evidencia del proveedor.

## 4. Data Protection: keyring y certificado

El keyring está en PostgreSQL y debe restaurarse con la base para descifrar cookies/tokens
existentes. En producción, sus registros están protegidos por un certificado X.509.

La clave privada del certificado:

- se guarda en vault/KMS o backup secreto separado;
- nunca se incluye en Git, imagen, dump SQL, artefacto CI ni log;
- tiene propietario, versión, caducidad y procedimiento de rotación;
- mantiene la versión anterior durante el periodo necesario para leer claves ya protegidas;
- se prueba tras cada rotación.

Escenarios:

- **DB restaurada sin keyring:** sesiones/tokens anteriores dejan de ser válidos.
- **DB/keyring restaurados sin certificado correcto:** el proceso puede no descifrar las claves.
- **certificado comprometido:** rotar certificado y keyring según investigación, revocar sesiones y
  conservar evidencia.

La recuperación puede optar conscientemente por invalidar todas las sesiones si no es seguro
conservarlas; debe comunicarse y registrarse.

## 5. Copia manual y restauración PostgreSQL

Usar preferentemente las herramientas gestionadas del proveedor. Para un ensayo aislado:

```bash
# La variable es secreta; no imprimirla ni guardarla en scripts versionados.
pg_dump --format=custom --no-owner --no-acl \
  --dbname="$MIGA_DATABASE_URL" \
  --file=miga-backup.dump

pg_restore --list miga-backup.dump
```

El dump contiene datos personales. Debe almacenarse cifrado, con permisos restrictivos, y borrarse
de forma segura tras el ensayo.

Restauración **solo en una base aislada y vacía**:

```bash
pg_restore --no-owner --no-acl \
  --dbname="$MIGA_RESTORE_DATABASE_URL" \
  miga-backup.dump
```

No uses `--clean`, `DROP`, `docker compose down -v` ni restaures sobre producción sin autorización,
target explícito, backup reciente y plan de vuelta atrás.

## 6. Ensayo de restauración

Frecuencia propuesta:

- mensual durante los tres primeros meses;
- trimestral cuando el procedimiento sea estable;
- adicional tras cambiar proveedor, versión mayor PostgreSQL, keyring o cifrado.

Checklist:

1. registrar ID/digest/fecha del backup sin copiar credenciales;
2. crear red y base aisladas sin tráfico de usuario;
3. restaurar certificado/keyring mediante el canal secreto;
4. restaurar dump/PITR al instante elegido;
5. ejecutar migraciones solo si corresponde a la versión del artefacto;
6. validar esquemas, constraints, recuentos aproximados y revisión de snapshots;
7. iniciar el artefacto compatible en modo no público;
8. comprobar health, login sintético, lectura del workspace, logout y descifrado Data Protection;
9. confirmar que un usuario no accede a otro;
10. medir RPO/RTO reales;
11. destruir de forma segura el entorno y registrar resultado.

No usar cuentas personales reales para smoke tests; prepara una cuenta sintética controlada.

Acta mínima:

```text
Fecha:
Responsable:
Backup/restore point:
Versión de aplicación/migración:
RPO observado:
RTO observado:
Checks ejecutados:
Incidencias:
Resultado: aprobado / rechazado
Próxima acción y fecha:
```

## 7. Recuperación por escenario

### Corrupción lógica

1. poner escrituras en mantenimiento;
2. conservar snapshot forense;
3. determinar primer instante corrupto;
4. restaurar PITR justo antes;
5. comparar y, si es viable, reaplicar operaciones válidas;
6. validar aislamiento y consistencia antes de reabrir.

### Borrado accidental

1. detener cleanup/migraciones implicadas;
2. identificar alcance exacto y workspace;
3. preferir recuperación granular en base aislada;
4. no restaurar toda producción si sobrescribiría datos nuevos;
5. documentar datos imposibles de recuperar, especialmente blobs locales.

### Credenciales comprometidas

1. revocar/rotar primero;
2. restringir acceso a base/backups;
3. preservar logs y snapshots;
4. crear nuevas credenciales con mínimo privilegio;
5. revisar exfiltración;
6. generar un backup limpio posterior;
7. invalidar sesiones/keyring solo según alcance.

### Proveedor o región no disponible

1. activar procedimiento de continuidad aprobado;
2. restaurar en cuenta/región separada;
3. usar la misma versión compatible de aplicación y migración;
4. actualizar DNS solo tras smoke tests;
5. evitar split-brain: una única región acepta escrituras.

## 8. Datos demo y cleanup

La demo no necesita backup de continuidad de usuario. Tras una restauración:

- conservar solo demos cuya expiración siga vigente;
- ejecutar cleanup idempotente;
- verificar que el filtro incluye `WorkspaceKind.Demo`;
- nunca ampliar la caducidad por el mero hecho de restaurar;
- no restaurar demos a costa de retrasar cuentas registradas.

## 9. Blobs y export local

Mientras los blobs sigan local-only:

- mostrar la limitación antes de exportar/borrar/cambiar de dispositivo;
- recomendar conservar archivos originales en almacenamiento elegido por el usuario;
- no afirmar que el JSON permite una restauración completa;
- probar que la importación no crea referencias engañosas a bytes ausentes;
- evaluar en una fase futura un paquete local versionado con manifiesto y hashes, sin inventar
  criptografía propia.

Si en el futuro se usa object storage:

- bucket privado, cifrado y versionado;
- claves de objeto generadas por servidor;
- MIME/magic bytes, cuotas y antivirus;
- inventario/hashes y consistencia con PostgreSQL;
- URLs firmadas breves;
- lifecycle y backup coordinados con eliminación de cuenta.

## 10. Responsables pendientes

Antes de producción el propietario debe asignar:

- responsable de backups;
- custodio de claves/certificados;
- aprobador de restauración;
- contacto de incidentes;
- calendario y presupuesto;
- proveedor y región;
- criterio legal de retención.
