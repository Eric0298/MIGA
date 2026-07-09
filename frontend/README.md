# Miga · Frontend

PWA mobile-first construida con React + TypeScript + Vite + Tailwind CSS v4.

## Requisitos

Node.js 20+.

## Configuración local

Copia `.env.example` a `.env.local` y ajusta los valores si tu backend no está en el puerto
por defecto:

```bash
cp .env.example .env.local
```

Variables disponibles:

- `VITE_API_URL` — Base URL del backend Miga.Api (se usa para el endpoint de metadata
  de YouTube). Solo `http://` o `https://`. El valor por defecto es `http://localhost:5000`.

## Scripts

```bash
npm run dev            # servidor de desarrollo
npm run build          # typecheck + build de producción
npm run preview        # servir la build
npm run test           # Vitest single run
npm run test:watch     # Vitest en watch
npm run typecheck      # verificar tipos sin emitir
npm run lint           # ESLint
npm run format         # Prettier
```

## Estructura

```
src/
  App.tsx              enrutado principal
  main.tsx             bootstrap React + fuente
  index.css            Tailwind + tokens de marca (@theme)
  components/
    layout/            AppShell, BottomNav
    ui/                EmptyState y primitives compartidos
  features/
    landing/           landing pública
    home/ timer/ goals/ sessions/ more/   pantallas dentro de /app
    architecture/      /arquitectura
    not-found/         404
  test/
    setup.ts           configuración global de Vitest
public/
  brand/               assets oficiales de MIGA (iconos PWA incluidos)
```

## Convenciones

- Alias `@/*` → `src/*`.
- Tailwind v4 con tokens en `@theme` de `src/index.css`.
- No usar gradients, chips decorativos ni repetir "MIGA" en cada componente.
- Mobile-first a partir de 360 px.
