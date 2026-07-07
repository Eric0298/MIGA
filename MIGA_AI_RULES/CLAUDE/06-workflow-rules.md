# MIGA — Workflow Rules

## 1. Forma de trabajar

El proyecto debe construirse como mentoría técnica fase por fase.

No avanzar a fases posteriores sin cerrar la fase actual.

No generar 30 archivos de golpe.

No implementar funcionalidades futuras antes de que toque.

## 2. Regla fundamental antes de tocar código

Antes de proponer cambios de código:

1. Inspeccionar los archivos reales implicados.
2. Entender la estructura existente.
3. Respetar lo que ya funciona.
4. Modificar solo lo necesario.
5. No inventar contenido de archivos.
6. No borrar lógica sin justificar.
7. Entregar archivos completos cuando se pida código final.

## 3. Formato obligatorio para cada módulo

Cada módulo debe entregarse con:

1. Objetivo.
2. Archivos que se crean o modifican.
3. Comandos necesarios.
4. Código completo.
5. Explicación paso a paso.
6. Cómo probarlo.
7. Posibles errores.
8. Checklist de terminado.

## 4. Prioridad actual

La prioridad actual es Fase 1:

- repositorio;
- frontend React + TypeScript + Vite;
- PWA;
- backend ASP.NET Core;
- PostgreSQL con Docker;
- docker-compose;
- health check;
- landing/demo básica;
- README.

## 5. No hacer todavía

No implementar todavía:

- auth;
- subida de archivos;
- IA;
- pagos;
- notificaciones avanzadas;
- sincronización compleja;
- app nativa;
- Google Play;
- App Store.

## 6. Commits recomendados

Usar commits pequeños y claros.

Ejemplos:

```text
chore: initialize monorepo structure
feat(frontend): setup React Vite PWA base
feat(backend): add ASP.NET Core health check
chore(docker): add PostgreSQL development compose
feat(landing): add initial MIGA public landing
```

## 7. Definición de terminado por fase

Una fase está terminada solo cuando:

- compila;
- se puede ejecutar localmente;
- se ha probado manualmente;
- no rompe lo anterior;
- tiene README o notas actualizadas;
- tiene checklist revisado;
- se puede hacer commit limpio.

## 8. Reglas de respuesta del agente

Cuando un agente proponga trabajo, debe ser claro y concreto.

Debe evitar:

- respuestas vagas;
- cambios masivos;
- reestructuraciones innecesarias;
- crear abstracciones sin necesidad;
- saltar a fases futuras;
- ignorar el branding;
- ignorar mobile-first.

Debe priorizar:

- pasos verificables;
- código mantenible;
- seguridad;
- diseño mobile-first;
- explicación entendible;
- continuidad del proyecto.

## 9. Criterio de mentoría

El usuario está construyendo un proyecto real de portfolio y aprendizaje.

Las respuestas deben explicar:

- qué se hace;
- por qué se hace;
- dónde se coloca;
- cómo se prueba;
- qué errores pueden aparecer;
- cómo saber si está correcto.
