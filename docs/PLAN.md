# Plan del proyecto — Regatas (Asistente Náutico)

Documento de continuación para retomar el desarrollo desde Claude Code.

## Contexto

App **web + PWA instalable** para saber de un vistazo si los próximos días son
recomendables para navegar a vela en el **Río de la Plata**, con alertas de marea
meteorológica y un planificador del cruce entre dos puntos (p.ej. La Plata → Colonia).

Decisión de producto clave: **multiusuario sin registro**. Cada usuario carga sus
barcos y lugares; todo se guarda en el navegador (localStorage). No hay backend ni login.

**Matiz del dominio (Río de la Plata):** la marea astronómica es chica; domina la
**marea meteorológica** por viento. Viento **SE persistente → sudestada** (sube el agua,
inunda el club). Viento **N/NW persistente → bajante** (baja el agua, varadura). Por eso
las alertas se derivan de dirección + persistencia del viento.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind · TanStack Query (caché + persistencia
offline) · Zod (validación de APIs) · Vitest (tests de dominio). PWA con manifest + SW.

## Estado actual (qué YA está hecho)

- **Panel `/`** — semáforo 🟢🟡🔴 por día (viento/ráfagas/lluvia/**niebla**/surge), con:
  - **Ícono de cielo** por tarjeta (☀️ ⛅ ☁️ 🌦️ 🌧️) según nubosidad/lluvia.
  - **Motivos con íconos** (🌬️ 💨 🌧️ 🌫️ 🌊…) — `src/lib/reasonIcon.ts`.
  - **Resumen de marea**: nivel observado (INA) + tendencia + aviso de agua alta/baja para
    la amarra (usa los niveles seguros de la amarra si están definidos).
  - **Gráfico horario**: barras viento/ráfagas, **flechas de dirección** por hora, líneas de
    umbral (poco viento azul —solo si aplica—, precaución, peligro) y **bandas de
    visibilidad reducida**.
- **Alertas `/alertas`** — sudestada/bajante + **niebla/visibilidad** (con ventana horaria)
  + nivel de agua observado del INA.
- **Cruce `/cruce`** — rankea salidas con la polar del barco. Considera **niebla y marea**,
  da **semáforo por salida**, lista en **orden cronológico**, evalúa **7 días**, usa la
  **tolerancia** del usuario y **recuerda** la selección salida/destino/barco.
- **Perfil `/perfil`** — barcos y lugares (con **niveles seguros de amarra**), tolerancia y
  **umbral de poco viento** configurable (`lowWindKt`, default 6). localStorage (`useProfile`).
- **Ayuda `/ayuda`** — guía de uso.
- **Polar generada por eslora** (`polarModel.ts`): velocidad de casco ≈ 1.34·√LWL.
- **Datos**: Open-Meteo (forecast: viento/ráfagas/dir/lluvia/temp/**visibility**/
  **cloud_cover**; marine: nivel del mar/olas) e INA (nivel observado). **Switch de mocks**.
  SMN/SHN: solo referencia, no se consultan.
- **Niebla** (`src/lib/domain/fog.ts` + visibilidad en scoring): la niebla matinal que
  despeja **no** marca el día rojo si queda ventana navegable (`FOG_NAVIGABLE_WINDOW_H`).
- **~70 tests** en verde. `tsc`, `lint` y `build` OK. PWA instalable + offline.

## Arquitectura (mapa de archivos)

```
src/
  app/                 page (/), alertas/, cruce/, perfil/, ayuda/, layout, providers
  components/          dashboard/ · alerts/ · crossing/ · common/ · ui/
  lib/
    domain/   (PURO, testeado) scoring · surge · fog · polar · polarModel · routing · geo · pointOfSail
    profile/  types (Profile: lowWindKt, crossing) · defaults · ProfileContext (useProfile)
    services/ http (switch mocks) · openMeteoForecast · openMeteoMarine · inaHidrologico · index (facade) · schemas
    transforms/ normalizeForecast · normalizeWaterLevel
    hooks/    useForecast (caution+lowWind) · useWaterLevel · useCrossingPlan (caution) · useFreshness
    config/   boat (umbrales, scoringFor) · routes (buildRoute) · inaStations · knownClubs
    types/    config · forecast (SkyCondition, FogAlert) · water · crossing
    reasonIcon.ts · format.ts
  mocks/      handlers (generador determinístico de fixtures)
tests/        geo · polar · polarModel · scoring · surge · fog · routing · …
```

Reglas: todo el fetch externo ocurre **en el cliente**; el dominio es **puro** (sin I/O)
y está cubierto por tests; los datos del usuario viven en localStorage.

## Comandos

```bash
npm install
npm run dev      # http://localhost:3000  (hot-reload)
npm test         # ~70 tests de dominio (sin red)
npm run build    # export estático -> carpeta out/
npm run lint
npx tsc --noEmit # typecheck
```

Mocks vs real: `NEXT_PUBLIC_USE_MOCKS` (default `true`). En este repo el `.env.local` lo
pone en `false` → `npm run dev` usa datos reales. Para mocks: `NEXT_PUBLIC_USE_MOCKS=true npm run dev`.

Preview "de producción": es `output: export`, así que **`next start` no sirve** →
`npm run build && npx serve out -l 3000`. Sin HMR: rebuild+reservir para ver cambios.

## Próximos pasos sugeridos (roadmap)

### Prioritario
- [x] **Integrar la API real del INA** (nivel de agua observado): se usa la API pública
      "a5" (`https://alerta.ina.gob.ar/a5/obs/puntual/series/{id}/observaciones`, sin auth,
      CORS abierto), variable altura hidrométrica (var=2). La estación se elige por cercanía
      al lugar activo (`src/lib/config/inaStations.ts`, `inaHidrologico.ts`). Pendiente menor:
      ampliar/curar el catálogo de estaciones.
- [ ] **Editar** barcos/lugares existentes (hoy solo alta/baja/selección).
      Ya existe `updateBoat` / `updateLocation` en `ProfileContext` — falta UI.
- [ ] **Importar/exportar perfil** (JSON) para llevarlo a otro dispositivo, ya que no
      hay backend.

### Mejoras de dominio
- [ ] Permitir cargar una **polar real (medida)** además de la generada por eslora.
- [ ] Sumar **olas y corriente** (Open-Meteo Marine ya se trae) al scoring y al cruce.
- [ ] **Amanecer/atardecer reales** por fecha/lat en vez de horas fijas
      (`DAYLIGHT` en `config/boat.ts`).
- [ ] Routing con **isócronas** (hoy es derrota fija sobre varias horas de salida).
- [ ] Enlazar/parsear el **modelo oficial de altura del SHN** en alertas.

### UX / PWA
- [ ] Notificaciones push de alerta de sudestada/bajante.
- [ ] Selector de **destinos favoritos** y más rutas guardadas.
- [ ] Íconos PWA en PNG (192/512) además del SVG actual.

## Cosas a tener en cuenta al continuar

- Coordenadas conocidas: amarra de ejemplo `-34.839876, -57.923381` (La Plata);
  Colonia `-34.47, -57.84`; Buenos Aires `-34.6, -58.37`.
- Mantener el dominio **puro y testeado**: cualquier lógica nueva de cálculo va en
  `src/lib/domain/` con su test en `tests/`.
- **Caché persistido (buster):** si cambiás la FORMA del `ForecastBundle`/`DayScore`/
  `CrossingPlan`/`DepartureCandidate`, subí el `buster` en `src/app/providers.tsx`
  (hoy `schema-8`) o la app crashea con caché viejo. Ya pasó 2 veces.
- **Preview:** `output: export` → `next start` no sirve; usar `npx serve out`. Sin HMR
  (rebuild para ver cambios). Matar servers `serve` zombies con `pkill -f "serve out"`.
- **Git:** se trabaja y pushea en `main`. El usuario pidió **consultar antes de commit/push**.
  `run.sh` y `validar_pronostico.txt` van sin trackear. En `validation/` hay snapshots de
  pronóstico para validar contra lo observado (`scripts/forecast-eval.mjs`).
- Pendiente evaluado pero no hecho: **METAR (SMN/aviación)** como observación real de
  visibilidad para reforzar la niebla (el pronóstico de niebla es flojo).
