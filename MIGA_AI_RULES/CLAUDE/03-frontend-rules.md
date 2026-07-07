# MIGA — Frontend Rules

## 1. Stack frontend

Usar:

- React;
- TypeScript;
- Vite;
- PWA;
- Zustand;
- React Hook Form;
- Zod;
- Dexie.js;
- Recharts;
- Vitest;
- Testing Library.

## 2. Arquitectura frontend

Usar estructura por features.

Estructura recomendada:

```text
frontend/
├── public/
│   ├── icons/
│   └── manifest.webmanifest
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   ├── assets/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   └── feedback/
│   ├── features/
│   │   ├── landing/
│   │   ├── dashboard/
│   │   ├── goals/
│   │   ├── activities/
│   │   ├── sessions/
│   │   ├── timer/
│   │   ├── materials/
│   │   ├── exams/
│   │   ├── review-questions/
│   │   └── settings/
│   ├── lib/
│   │   ├── api/
│   │   ├── db/
│   │   ├── validation/
│   │   ├── dates/
│   │   └── security/
│   ├── store/
│   ├── styles/
│   ├── types/
│   └── test/
├── .env.example
├── package.json
├── vite.config.ts
└── README.md
```

## 3. Reglas React

- Usar componentes funcionales.
- Usar TypeScript de forma estricta.
- Evitar `any` salvo justificación clara.
- Separar UI, lógica de negocio y persistencia.
- No meter lógica compleja de cálculo directamente en componentes.
- Extraer cálculos a `lib/` o al feature correspondiente.
- Mantener componentes pequeños y legibles.
- No crear abstracciones prematuras.

## 4. Estado global

Usar Zustand para estado global cuando sea necesario.

No llevar todo a Zustand.

Usar estado global para:

- sesión activa del temporizador;
- preferencias de usuario;
- modo invitado/cuenta;
- datos compartidos entre pantallas.

Usar estado local para:

- inputs temporales;
- modales;
- toggles locales;
- formularios gestionados por React Hook Form.

## 5. Formularios y validación

Usar:

- React Hook Form para formularios.
- Zod para esquemas de validación.

Regla:

```text
Toda validación importante debe existir también en backend cuando haya API.
```

El frontend ayuda a UX, pero no es autoridad de seguridad.

## 6. PWA

MIGA debe ser PWA desde Fase 1.

Configurar:

- `manifest.webmanifest`;
- nombre de app;
- short name;
- theme color;
- background color;
- icons;
- display standalone;
- start URL;
- service worker cuando proceda.

Valores recomendados:

```json
{
  "name": "MIGA",
  "short_name": "MIGA",
  "display": "standalone",
  "background_color": "#FFF7EC",
  "theme_color": "#FF8A4C"
}
```

## 7. Local-first

El modo invitado debe funcionar sin backend.

Usar IndexedDB mediante Dexie.js para:

- metas locales;
- actividades locales;
- sesiones locales;
- estado del temporizador;
- materiales locales sin archivo servidor;
- simulacros;
- preguntas manuales;
- configuración local.

## 8. Exportar/importar JSON

Debe existir una estrategia de backup local:

- exportar datos a JSON;
- importar datos desde JSON;
- validar estructura antes de importar;
- evitar sobrescrituras accidentales;
- mostrar aviso claro antes de reemplazar/fusionar.

## 9. Temporizador

El temporizador no debe usar `setInterval` como fuente de verdad.

`setInterval` solo puede servir para pintar la UI.

La fuente de verdad debe ser:

- `startedAt`;
- `pausedAt`;
- `resumedAt`;
- `endedAt`;
- `totalPausedSeconds`.

El temporizador debe sobrevivir a:

- recarga;
- cierre de pestaña;
- bloqueo móvil;
- app en segundo plano;
- reapertura.

## 10. Accesibilidad

La UI debe cuidar:

- contraste suficiente;
- botones con área táctil cómoda;
- labels reales en formularios;
- navegación por teclado donde aplique;
- estados de error claros;
- no depender solo del color.

## 11. Testing frontend

Probar especialmente:

- cálculo de progreso;
- cálculo del temporizador;
- import/export JSON;
- formularios principales;
- render de dashboard;
- persistencia IndexedDB;
- estados vacíos;
- errores de validación.

Usar:

- Vitest para funciones;
- Testing Library para componentes.

## 12. Diseño UI

Respetar siempre `02-design-rules.md`.

No introducir:

- gradients;
- tags decorativos;
- eyebrows repetidos;
- nomenclatura repetitiva;
- UI SaaS genérica;
- sombras excesivas;
- animaciones innecesarias.
