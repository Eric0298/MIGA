# CODEX — Cómo usar estas reglas

Esta carpeta contiene reglas para trabajar con Codex o agentes de programación en el proyecto **MIGA**.

## Archivo principal

El archivo principal es:

```text
AGENTS.md
```

Si tu herramienta busca automáticamente `AGENTS.md`, copia este archivo a la raíz del repositorio.

## Archivos de apoyo

- `01-product-context.md`: visión de producto, alcance y prioridades.
- `02-design-rules.md`: branding, paleta, UI mobile-first y restricciones visuales.
- `03-frontend-rules.md`: reglas para React, TypeScript, Vite, PWA, Zustand, Dexie y testing.
- `04-backend-rules.md`: reglas para ASP.NET Core, PostgreSQL, EF Core y arquitectura.
- `05-security-rules.md`: seguridad, subida de archivos, auth futura y OWASP.
- `06-workflow-rules.md`: forma de trabajar fase por fase.
- `07-prompt-templates.md`: prompts listos para pedir trabajo a Codex.

## Regla importante

Codex debe modificar el mínimo necesario, respetar la arquitectura existente y no generar grandes bloques de código sin haber inspeccionado antes el proyecto real.
