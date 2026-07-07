# MIGA — Product Context

## 1. Identidad del proyecto

**MIGA** es una aplicación PWA mobile-first para gestionar tiempo, metas, sesiones, materiales, simulacros, preguntas de repaso y progreso real.

El concepto de marca se basa en la idea de que pequeñas acciones acumuladas generan progreso significativo.

Claim de marca:

```text
Small actions. Big progress.
```

## 2. Tipo de aplicación

MIGA será primero una **PWA mobile-first instalable**.

No será una app nativa en el MVP.
No se publicará inicialmente en App Store ni en Google Play para evitar costes de publicación.

La app debe poder instalarse desde navegador en móvil:

- Android: instalación desde Chrome como PWA.
- iOS: añadir a pantalla de inicio desde Safari.

## 3. Objetivo personal y profesional

MIGA debe servir para dos objetivos al mismo tiempo:

1. Uso personal real: organizar estudio, trabajo, proyectos, inglés, ingeniería, hábitos y sesiones de concentración.
2. Portfolio profesional: demostrar arquitectura fullstack seria, UX mobile-first, seguridad, documentación, testing y buenas prácticas.

## 4. MIGA no es una simple app de tareas

MIGA no debe centrarse únicamente en listas de tareas.

Debe centrarse en:

- tiempo invertido;
- sesiones reales;
- metas medibles;
- ritmo esperado;
- progreso acumulado;
- materiales trabajados;
- simulacros;
- preguntas de repaso;
- estadísticas;
- continuidad.

## 5. Preguntas que debe responder el producto

MIGA debe ayudar al usuario a responder:

- ¿Cuánto tiempo he dedicado hoy?
- ¿Cuánto tiempo he dedicado esta semana?
- ¿Cuánto tiempo me falta para cumplir mi objetivo?
- ¿Voy al día, atrasado o adelantado?
- ¿Qué tipo de actividades estoy haciendo más?
- ¿Qué materiales he trabajado?
- ¿Qué simulacros he hecho y con qué resultado?
- ¿Qué preguntas tengo pendientes de repaso?
- ¿Qué sesión tengo activa?
- ¿Dónde estoy perdiendo constancia?

## 6. Público objetivo

MIGA debe servir para:

- estudiantes universitarios;
- opositores;
- personas que preparan certificaciones;
- desarrolladores que estudian tecnologías;
- trabajadores que quieren medir tiempo dedicado a tareas;
- freelancers;
- personas con objetivos personales;
- recruiters que evalúen el proyecto como portfolio.

## 7. Principios de producto

- Mobile-first.
- PWA-first.
- Local-first.
- Sin login obligatorio.
- Cuenta opcional en fases posteriores.
- Sin IA en el MVP.
- Temporizador fiable por timestamps.
- Seguridad desde el diseño.
- Desarrollo fase por fase.
- No sobredimensionar el MVP.
- No generar 30 archivos de golpe.

## 8. MVP recomendado

El MVP debe priorizar:

1. Landing pública sencilla.
2. PWA instalable.
3. Modo invitado/local-first.
4. Metas.
5. Actividades libres.
6. Sesiones manuales.
7. Temporizador fiable.
8. Dashboard básico.
9. Estadísticas iniciales.
10. Exportar/importar JSON.

## 9. Fuera del MVP

Queda fuera del MVP:

- IA generadora de preguntas.
- App nativa.
- App Store.
- Google Play.
- Pagos.
- Planes premium.
- Integraciones externas.
- Colaboración multiusuario.
- Sincronización offline compleja.
- Web Push avanzado desde el primer día.
- Subida avanzada de archivos en Fase 1.

## 10. Roadmap base

### Fase 1 — Base PWA

- Crear repositorio.
- Crear frontend React + TypeScript + Vite.
- Configurar PWA.
- Crear backend ASP.NET Core.
- Crear PostgreSQL con Docker.
- Crear health check backend.
- Crear landing/demo básica.
- Crear README inicial.

### Fase 2 — Core de progreso

- Metas.
- Sesiones.
- Temporizador local por timestamps.
- Registro manual de sesiones.
- Cálculo de horas realizadas y pendientes.
- Dashboard básico.

### Fase 3 — Local-first

- IndexedDB con Dexie.
- Persistencia local.
- Exportar/importar JSON.
- Aviso de datos locales.

### Fase 4 — Cuenta opcional

- Registro.
- Login.
- Logout.
- Sesión segura.
- Sincronización básica.

### Fase 5 — Materiales y archivos

- Materiales.
- Enlaces.
- Subida segura.
- Detección de duración de vídeo.
- Crear sesión desde vídeo.

### Fase 6 — Simulacros y repaso

- Simulacros.
- Métricas de simulacros.
- Preguntas manuales.
- Modo repaso.

### Fase 7 — Pulido portfolio

- Estadísticas avanzadas.
- Notificaciones.
- Documentación.
- Capturas.
- Demo pública.
