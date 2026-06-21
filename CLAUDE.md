# Regatas — guía para Claude Code

App web + PWA (Next.js 14 App Router + TypeScript + Tailwind) que evalúa si conviene
navegar a vela en el Río de la Plata, con alertas de marea meteorológica (sudestada /
bajante) y un planificador de cruce entre dos puntos según el viento.

**El plan completo, el estado y el roadmap están en [`docs/PLAN.md`](docs/PLAN.md). Leelo
antes de seguir.**

## Comandos

```bash
npm run dev       # http://localhost:3000 (usa datos mock por defecto)
npm test          # tests de dominio (sin red)
npm run build     # build de producción
npm run lint
npx tsc --noEmit  # typecheck
```

## Convenciones

- **Multiusuario sin registro**: los datos del usuario (barcos, lugares, preferencias)
  viven en el navegador vía `src/lib/profile/ProfileContext.tsx` (`useProfile`). No hay backend.
- **Fetch solo del lado del cliente.** Hay un switch de mocks (`NEXT_PUBLIC_USE_MOCKS`,
  default `true`) para que build/tests/dev corran sin red. Implementado en `src/lib/services/`.
- **Dominio puro y testeado**: toda lógica de cálculo va en `src/lib/domain/` (scoring,
  surge, polar, polarModel, routing, geo) con su test en `tests/`. No mezclar I/O ahí.
- Idioma de la UI y los textos: **español**.
- Rama de trabajo: `claude/sailing-weather-planner-s9atbe`. No pushear a otra rama.

## Estructura rápida

- `src/app/` — páginas: `/` (panel), `/alertas`, `/cruce`, `/perfil`.
- `src/lib/domain/` — lógica pura (con tests en `tests/`).
- `src/lib/profile/` — perfil del usuario en localStorage.
- `src/lib/services/` — borde de red (Open-Meteo / INA) + mocks.
- `src/lib/config/` — umbrales del semáforo y construcción de rutas/polar.
