# Política de seguridad de MIGA

## Versiones soportadas

MIGA todavía no publica versiones estables ni mantiene ramas de soporte. Solo se evalúa la revisión
actual de `main`. Los commits, forks, despliegues o copias anteriores pueden conservar
vulnerabilidades ya corregidas.

## Cómo comunicar una vulnerabilidad

No publiques vulnerabilidades, secretos, datos personales ni instrucciones de explotación en una
issue pública.

Canal preferido:

1. usa el formulario privado de
   [GitHub Security Advisories](https://github.com/Eric0298/MIGA/security/advisories/new), si está
   habilitado;
2. si GitHub indica que el canal no está disponible, contacta al mantenedor desde su perfil de
   GitHub y solicita un canal privado sin incluir detalles técnicos en público.

El propietario debe habilitar y comprobar Private Vulnerability Reporting antes de desplegar MIGA.
No existe una dirección de correo de seguridad verificada en este repositorio.

Incluye, sin datos reales:

- versión, commit o URL afectada;
- componente y precondiciones;
- pasos mínimos para reproducir en un entorno controlado;
- impacto observado;
- propuesta de mitigación, si la conoces;
- cualquier evidencia redactada.

No adjuntes contraseñas, cookies, tokens completos, bases de datos ni información personal.

## Objetivos de respuesta

Son objetivos operativos, no una garantía contractual:

| Severidad inicial |    Acuse de recibo |          Primera evaluación |                        Objetivo de mitigación |
| ----------------- | -----------------: | --------------------------: | --------------------------------------------: |
| Crítica           |           24 horas |                    48 horas | contención inmediata y corrección prioritaria |
| Alta              |  2 días laborables |           5 días laborables |                                       14 días |
| Media             |  5 días laborables |          10 días laborables |                                       30 días |
| Baja              | 10 días laborables | siguiente ciclo planificado |                                       90 días |

Los plazos pueden cambiar según reproducibilidad, impacto y dependencia de proveedores. El
reportante recibirá actualizaciones cuando exista un canal privado operativo.

## Alcance

Incluido:

- frontend y PWA;
- API ASP.NET Core;
- autenticación, sesiones, demo y aislamiento de workspaces;
- persistencia PostgreSQL e IndexedDB;
- configuración, CI/CD y dependencias;
- importación/exportación, privacidad y eliminación.

No autorizado:

- atacar despliegues de terceros o producción sin permiso escrito;
- denegación de servicio, spam, credential stuffing o pruebas destructivas;
- acceder, modificar o descargar datos ajenos;
- ingeniería social;
- publicar una vulnerabilidad antes de coordinar su corrección.

Usa cuentas y datos ficticios. Detén la prueba en cuanto confirmes acceso no autorizado.

## Tratamiento de secretos expuestos

Un secreto versionado o compartido se considera comprometido aunque después se borre del árbol
actual:

1. revocarlo o rotarlo en el proveedor;
2. revisar uso y logs;
3. sustituirlo por referencia a un gestor de secretos;
4. comprobar artefactos, caches, forks y logs de CI;
5. valorar reescritura de historial solo después de rotar y con coordinación explícita.

La antigua contraseña PostgreSQL de desarrollo fue redactada de los documentos actuales, pero sigue
existiendo en el historial Git. Si se reutilizó fuera del entorno local, debe rotarse. Esta política
no autoriza reescribir el historial automáticamente.

## Divulgación coordinada

Se agradece dar tiempo razonable para investigar, probar y desplegar una corrección antes de hacer
públicos los detalles. MIGA reconocerá la contribución si el reportante lo desea y si hacerlo no
incrementa el riesgo.

El procedimiento interno completo está en
[docs/security/INCIDENT_RESPONSE.md](docs/security/INCIDENT_RESPONSE.md).
