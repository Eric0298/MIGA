# MIGA — Design Rules

## 1. Branding

MIGA tiene una identidad visual cálida, limpia, redondeada y mobile-first.

La marca visual se inspira en:

- un icono orgánico naranja/apricot;
- tipografía redondeada;
- fondos claros tipo cream;
- tarjetas suaves;
- contraste fuerte con charcoal;
- estados positivos con pistachio.

Claim:

```text
Small actions. Big progress.
```

## 2. Paleta oficial

| Color | Hex | Uso recomendado |
|---|---:|---|
| Apricot | `#FF8A4C` | Acción primaria, icono, botones principales |
| Peach | `#FFDCC2` | Fondos secundarios, superficies suaves |
| Cream | `#FFF7EC` | Fondo principal |
| Charcoal | `#1F1F1F` | Texto principal, contraste, logo |
| Pistachio | `#A7CDA3` | Progreso positivo, éxito, estado al día |

## 3. Variables recomendadas

Usar tokens claros desde el principio.

```css
:root {
  --color-apricot: #FF8A4C;
  --color-peach: #FFDCC2;
  --color-cream: #FFF7EC;
  --color-charcoal: #1F1F1F;
  --color-pistachio: #A7CDA3;

  --color-background: var(--color-cream);
  --color-surface: #FFFFFF;
  --color-surface-soft: var(--color-peach);
  --color-text: var(--color-charcoal);
  --color-primary: var(--color-apricot);
  --color-success: var(--color-pistachio);

  --radius-sm: 0.75rem;
  --radius-md: 1rem;
  --radius-lg: 1.5rem;
  --radius-xl: 2rem;
}
```

## 4. Regla anti-gradients

No usar gradients en MIGA salvo petición explícita.

Prohibido por defecto:

```css
background: linear-gradient(...);
```

Preferir:

```css
background: #FFF7EC;
background: #FFDCC2;
background: #FF8A4C;
```

## 5. Regla anti-tags decorativos

No usar tags, chips, badges o pills decorativos si no tienen valor funcional real.

Evitar:

```text
[PWA] [PRODUCTIVITY] [TIME TRACKER] [GOALS]
```

Permitir solo si cumplen una función real, por ejemplo:

- estado de una meta;
- prioridad;
- filtro activo;
- tipo de sesión seleccionado.

## 6. Regla anti-eyebrows

Evitar textos pequeños en mayúscula encima de cada sección.

Evitar:

```text
FEATURES
Todo lo que necesitas para avanzar
```

Preferir:

```text
Todo lo que necesitas para avanzar
```

## 7. Regla anti-nomenclatura repetitiva

No repetir el nombre MIGA en cada pantalla o componente.

Evitar:

```text
MIGA Dashboard
MIGA Goals
MIGA Timer
MIGA Sessions
MIGA Statistics
```

Preferir:

```text
Inicio
Metas
Timer
Sesiones
Estadísticas
```

Usar MIGA principalmente en:

- landing;
- logo;
- manifest PWA;
- README;
- metadatos;
- documentación técnica.

## 8. Tono visual

La interfaz debe sentirse:

- calmada;
- humana;
- útil;
- clara;
- cálida;
- ligera;
- no corporativa fría;
- no infantil;
- profesional sin parecer una plantilla SaaS genérica.

## 9. Tipografía

La marca visual usa una tipografía redondeada tipo “Miga Rounded”.

Si la fuente exacta no está disponible, usar una alternativa rounded sans-serif.

Opciones razonables:

- Nunito;
- Quicksand;
- Plus Jakarta Sans;
- Manrope;
- Inter como fallback neutro.

No incluir archivos de fuente privados en el repositorio salvo licencia clara.

## 10. Mobile-first

Cada pantalla debe diseñarse primero para móvil.

Base mínima de referencia:

```text
360px de ancho
```

La versión desktop puede mejorar el layout, pero no debe definir la experiencia base.

## 11. Navegación móvil recomendada

```text
Inicio | Timer | Metas | Sesiones | Más
```

Debe ser simple, clara y usable con una mano.

## 12. Componentes visuales recomendados

Crear componentes simples:

- Button;
- Card;
- Input;
- Textarea;
- Select;
- Modal;
- BottomSheet;
- ProgressBar;
- StatCard;
- EmptyState;
- AppShell;
- MobileNav.

Evitar componentes hiperabstractos demasiado pronto.

## 13. Cards

Las cards deben ser:

- redondeadas;
- limpias;
- con buen espacio interno;
- sin sombras exageradas;
- sin efectos futuristas;
- sin gradients;
- con bordes suaves si hace falta.

Ejemplo conceptual:

```text
┌─────────────────────────────┐
│ Hoy                         │
│ 1 h 25 min                  │
│ Has completado 3 sesiones   │
└─────────────────────────────┘
```

## 14. Estados de progreso

| Estado | Tratamiento visual |
|---|---|
| Adelantado | Pistachio, tono positivo |
| Al día | Pistachio o charcoal suave |
| Leve retraso | Apricot suave |
| Retraso importante | Apricot más marcado |
| Riesgo crítico | Mensaje claro, sin dramatizar |

Evitar rojos agresivos al principio. MIGA debe corregir sin castigar visualmente.

## 15. Copy UI

Usar textos cortos y humanos.

Buenos ejemplos:

```text
Has avanzado 42 minutos hoy.
Vas al día.
Te faltan 2 h esta semana.
Hay una sesión activa.
Retoma donde lo dejaste.
```

Evitar:

```text
Maximize your productivity potential.
Unlock your workflow.
MIGA Productivity Intelligence System.
```
