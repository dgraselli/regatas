# Regatas — guía para Claude Code

App web + PWA (Next.js 14 App Router + TypeScript + Tailwind) que evalúa si conviene
navegar a vela o motor en el Río de la Plata, con alertas de marea meteorológica
(sudestada / bajante) y un planificador de cruce entre dos puntos según el viento.

**El plan completo, el estado y el roadmap están en [`docs/PLAN.md`](docs/PLAN.md). Leelo
antes de seguir.**

## Comandos

```bash
npm run dev       # http://localhost:3000 (con hot-reload)
npm test          # tests de dominio (sin red)
npm run build     # genera la carpeta out/ (export estático)
npm run lint
npx tsc --noEmit  # typecheck
```

**Mocks vs datos reales:** `NEXT_PUBLIC_USE_MOCKS` (default `true`). En este repo el
`.env.local` lo pone en **`false`**, así que `npm run dev` usa **datos reales** (Open-Meteo /
INA). Para correr sin red: `NEXT_PUBLIC_USE_MOCKS=true npm run dev`.

**Preview "de producción":** el proyecto es `output: export` → **`next start` NO sirve**.
Es `npm run build` y luego `npx serve out -l 3000`. El export estático **no tiene HMR**:
para ver un cambio hay que **rebuild + reservir**. Cuidado con servers `serve` zombies
(matarlos con `pkill -f "serve out"`). Si ves "Cargando…" infinito: `rm -rf .next out` y
reconstruir.

## Convenciones

- **Multiusuario sin registro**: los datos del usuario (barcos, lugares, preferencias)
  viven en el navegador vía `src/lib/profile/ProfileContext.tsx` (`useProfile`). No hay backend.
- **Fetch solo del lado del cliente.** Hay un switch de mocks (`NEXT_PUBLIC_USE_MOCKS`,
  default `true`) para que build/tests/dev corran sin red. Implementado en `src/lib/services/`.
- **Dominio puro y testeado**: toda lógica de cálculo va en `src/lib/domain/` (scoring,
  surge, fog, polar, polarModel, routing, geo) con su test en `tests/`. No mezclar I/O ahí.
- Idioma de la UI y los textos: **español**.
- **Caché persistido (buster):** el pronóstico y el plan de cruce se cachean en localStorage
  vía TanStack Query (`src/app/providers.tsx`). **Si cambia la FORMA de esos datos**
  (campos nuevos en `ForecastBundle`, `DayScore`, `CrossingPlan`/`DepartureCandidate`),
  hay que **subir el `buster`** (`schema-N`) o la app crashea sirviendo caché viejo. Pasó
  varias veces. Valor actual: `schema-13`.
- **Git:** se trabaja y pushea en `main`. El usuario pidió **consultar antes de commitear o
  pushear** (no hacerlo automáticamente). `run.sh` y `validar_pronostico.txt` van sin trackear.

## Estructura rápida

- `src/app/` — páginas: `/` (panel), `/alertas`, `/cruce`, `/perfil`, `/ayuda`.
- `src/lib/domain/` — lógica pura (con tests en `tests/`): scoring, surge, fog, routing, polar,
  **sun** (amanecer/atardecer reales por fecha/lat, algoritmo USNO; `daylightHours` con fallback
  a `DAYLIGHT` fijo si no se pasa `location`), **metar** (normaliza observación METAR de
  visibilidad/niebla; lo usa el validador `scripts/metar-eval.mjs` y el panel vía `services/metar.ts` → proxy `/api/metar`, Cloudflare Worker en `worker/`)…
- `src/lib/profile/` — perfil del usuario en localStorage.
- `src/lib/services/` — borde de red (Open-Meteo / INA) + mocks.
- `src/lib/config/` — umbrales del semáforo y construcción de rutas/polar.

## Features actuales (resumen)

- **Vela / motor**: cada barco tiene `propulsion` (`'vela'|'motor'`, default vela) y, a
  motor, `cruiseKt`. A **vela** el poco viento penaliza (`poco-viento`); a **motor** no (agua
  tranquila = ideal) y el cruce se calcula a **velocidad de crucero constante**, no con la
  polar. Se hila por `scoreDay/scoreDays` (5º arg) y `planCrossing` (opción `propulsion`/
  `cruiseKt`). El picker de barco (panel y cruce) **solo aparece con >1 barco**.
- **Olas**: `wave_height` (Open-Meteo Marine) entra al scoring como factor propio
  (`waveYellowM`/`waveRedM` en `SCORING`/`scoringFor`, movidos por tolerancia). Afecta a vela
  y motor. La grilla marina es gruesa → orientativo. Se mapea en `normalizeForecast`
  (`waveHeightM`) y se muestra en la tarjeta/motivos. En el **cruce** además se usan
  `wave_direction`/`wave_period`: la ola por tramo se clasifica respecto del rumbo
  (`waveSector`: proa→cabeceo, través→balanceo) y escala el semáforo de la salida por altura
  **efectiva** (`Hs × waveSeverityFactor` según sector), no solo por altura.
  **Corriente**: no implementada.
- **Panel**: semáforo por día (viento/ráfagas/lluvia/niebla/**olas**/marea), ícono de cielo
  (☀️⛅☁️🌧️) por tarjeta, motivos con íconos, resumen de marea (nivel observado + agua
  alta/baja para la amarra), y gráfico horario (barras viento/ráfagas, **flechas de
  dirección**, líneas de umbral precaución/peligro y **poco viento** —solo si aplica—,
  bandas de visibilidad reducida).
- **Niebla**: `detectFog` + visibilidad en el scoring (niebla matinal que despeja **no**
  hunde el día; ver `FOG_NAVIGABLE_WINDOW_H`). Aparece en panel, alertas y gráfico.
- **Cruce**: considera niebla, marea y **olas**, da **semáforo por salida**, lista en **orden
  cronológico**, evalúa **7 días**, usa la **tolerancia** del usuario y **recuerda** la
  selección salida/destino/barco. La **ola por tramo** se cruza con el rumbo: de proa →
  **cabeceo**, de través → **balanceo** (vela y motor); una ola grande también baja el semáforo
  de la salida **modulada por la dirección**: escala por la altura EFECTIVA (`Hs ×
  waveSeverityFactor`: proa/través=1, aleta=0.75, popa=0.6), con los mismos umbrales de
  tolerancia. Usa `wave_direction`/`wave_period` de Open-Meteo Marine (`waveSector`/
  `waveSeverityFactor` en `pointOfSail.ts`). El panel, en cambio, mira solo la altura.
- **Perfil**: barcos (**propulsión vela/motor** + eslora, y vel. de crucero si es motor),
  lugares (con niveles seguros de amarra), tolerancia, y **umbral de poco viento**
  configurable (`lowWindKt`, default 6).
- Datos: Open-Meteo (forecast: viento, ráfagas, dir, lluvia, temp, **visibility**,
  **cloud_cover**; marine: nivel del mar, **olas: altura/dirección/período**) e INA (nivel
  observado). SMN/SHN: solo referencia, no se consultan (ver memoria/PLAN).
