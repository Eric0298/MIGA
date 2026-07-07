# MIGA — AI Rules Pack

Este paquete contiene reglas preparadas para trabajar con asistentes de IA en el proyecto MIGA.

## Carpetas incluidas

- `CLAUDE/`: contexto y reglas para Claude / Claude Code.
- `CODEX/`: contexto y reglas para Codex / agentes de programación.

## Uso recomendado

1. Copia la carpeta `CLAUDE` dentro del proyecto.
2. Copia la carpeta `CODEX` dentro del proyecto.
3. Si usas Claude Code, copia también `CLAUDE/CLAUDE.md` a la raíz del repositorio si tu configuración lo requiere.
4. Si usas Codex u otro agente compatible con `AGENTS.md`, copia también `CODEX/AGENTS.md` a la raíz del repositorio si tu herramienta lo requiere.

## Decisiones centrales

- El proyecto se llama **MIGA**.
- MIGA será una **PWA mobile-first**.
- No habrá App Store ni Google Play en el MVP.
- No habrá IA en el MVP.
- No habrá login obligatorio.
- El modo invitado/local-first es prioritario.
- El temporizador debe calcular con timestamps reales, no con `setInterval` como fuente de verdad.
- El diseño debe respetar la identidad visual: cálido, redondeado, limpio, mobile-first y sin gradients.
