# MIGA — Prompt Templates for Claude

## 1. Prompt para iniciar sesión de trabajo

```text
Vamos a trabajar en MIGA.

Antes de proponer cambios, revisa las reglas del proyecto y respeta:
- PWA mobile-first;
- no gradients;
- no tags decorativos;
- no eyebrows repetitivos;
- no repetir MIGA en cada sección;
- modo invitado/local-first como prioridad;
- temporizador basado en timestamps;
- no IA en MVP;
- no auth hasta Fase 4;
- no subida de archivos hasta Fase 5.

No generes código todavía. Primero dime qué archivos reales necesitas revisar para continuar.
```

## 2. Prompt para pedir implementación de un módulo

```text
Quiero implementar el módulo: [NOMBRE DEL MÓDULO].

Respeta la fase actual: [FASE].

Antes de escribir código:
1. Revisa los archivos reales implicados.
2. Dime qué vas a modificar.
3. No toques nada no relacionado.
4. Mantén el diseño mobile-first de MIGA.
5. Entrega archivos completos, no fragmentos sueltos.

Formato de respuesta:
- Objetivo.
- Archivos afectados.
- Comandos.
- Código completo.
- Explicación paso a paso.
- Cómo probarlo.
- Posibles errores.
- Checklist.
```

## 3. Prompt para revisión de código

```text
Revisa este módulo de MIGA como arquitecto senior fullstack.

Quiero que compruebes:
- coherencia con la arquitectura;
- errores de TypeScript/C#;
- seguridad;
- mobile-first;
- accesibilidad;
- duplicación;
- nombres confusos;
- lógica de negocio mal ubicada;
- si respeta las reglas visuales de MIGA.

No reescribas todo. Propón solo cambios necesarios y justificados.
```

## 4. Prompt para diseño UI

```text
Diseña esta pantalla de MIGA: [PANTALLA].

Reglas visuales obligatorias:
- mobile-first;
- paleta: Apricot #FF8A4C, Peach #FFDCC2, Cream #FFF7EC, Charcoal #1F1F1F, Pistachio #A7CDA3;
- sin gradients;
- sin tags decorativos;
- sin eyebrows repetitivos;
- sin repetir MIGA innecesariamente;
- cards redondeadas;
- tono cálido, claro y útil.

Primero dame la estructura UX textual. No escribas código todavía.
```

## 5. Prompt para debugging

```text
Tengo este error en MIGA:

[PEGAR ERROR]

Archivos relacionados:
[PEGAR O INDICAR ARCHIVOS]

Antes de cambiar código:
1. Explica qué significa el error.
2. Indica posibles causas.
3. Pide revisar los archivos necesarios si faltan.
4. Propón la solución mínima.
5. Entrega el archivo completo corregido si procede.
```
