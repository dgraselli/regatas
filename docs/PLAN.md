# Plan del proyecto — Regatas (Asistente Náutico)

Documento de continuación para retomar el desarrollo desde Claude Code.

## Contexto

App **web + PWA instalable** para saber de un vistazo si los próximos días son
recomendables para navegar a **vela o motor** en el **Río de la Plata**, con alertas de
marea meteorológica y un planificador del cruce entre dos puntos (p.ej. La Plata → Colonia).

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

- **Vela / motor** — cada barco tiene `propulsion` (`'vela'|'motor'`, default vela) y, a
  motor, `cruiseKt`. A vela el poco viento penaliza (`poco-viento`); a motor no (agua
  tranquila = ideal) y el cruce se calcula a **velocidad de crucero constante** en vez de
  con la polar (sin zona muerta/rizos; avisa "mar formado" con ráfagas). Se hila por
  `scoreDay/scoreDays` y `planCrossing` (opción `propulsion`/`cruiseKt`), y por los hooks
  (en la queryKey). El selector de barco (panel y cruce) solo aparece con **>1 barco**.
- **Panel `/`** — semáforo 🟢🟡🔴 por día (viento/ráfagas/lluvia/**niebla**/**olas**/surge), con:
  - **Ícono de cielo** por tarjeta (☀️ ⛅ ☁️ 🌦️ 🌧️) según nubosidad/lluvia.
  - **Motivos con íconos** (🌬️ 💨 🌧️ 🌫️ 🌊…) — `src/lib/reasonIcon.ts`.
  - **Resumen de marea**: nivel observado (INA) + tendencia + aviso de agua alta/baja para
    la amarra (usa los niveles seguros de la amarra si están definidos).
  - **Gráfico horario**: barras viento/ráfagas, **flechas de dirección** por hora, líneas de
    umbral (poco viento azul —solo si aplica—, precaución, peligro) y **bandas de
    visibilidad reducida**.
- **Alertas `/alertas`** — sudestada/bajante + **niebla/visibilidad** (con ventana horaria)
  + nivel de agua observado del INA.
- **Cruce `/cruce`** — rankea salidas con la polar del barco. Considera **niebla, marea y
  olas** (ola por tramo respecto del rumbo: proa→cabeceo, través→balanceo), da **semáforo por
  salida**, lista en **orden cronológico**, evalúa **7 días**, usa la **tolerancia** del usuario
  y **recuerda** la selección salida/destino/barco.
- **Perfil `/perfil`** — barcos (**propulsión vela/motor** + eslora, y vel. de crucero si es
  motor) y lugares (con **niveles seguros de amarra**), tolerancia y **umbral de poco viento**
  configurable (`lowWindKt`, default 6). localStorage (`useProfile`).
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
- [x] Sumar **olas** al scoring del panel (`waveHeightM` mapeado en `normalizeForecast`;
      umbrales `waveYellowM`/`waveRedM` en `scoringFor`, movidos por tolerancia; afecta vela y
      motor; grilla marina gruesa → orientativo).
- [x] Llevar la ola al **cruce**: `wave_direction`/`wave_period` de Marine → por tramo se
      clasifica respecto del rumbo (`waveSector`: proa→cabeceo, través→balanceo) y una ola
      grande baja el semáforo de la salida por altura **efectiva** (`Hs × waveSeverityFactor`:
      proa/través=1, aleta=0.75, popa=0.6), o sea la dirección modula el umbral. Pendiente:
      sumar **corriente** (Open-Meteo oceánica
      no sirve bien en el estuario) y el **canal obligatorio de salida/entrada** (tramo con rumbo
      fijo por lugar, p. ej. La Plata ~40 min).
- [x] **Amanecer/atardecer reales** por fecha/lat (`src/lib/domain/sun.ts`, algoritmo USNO,
      dominio puro): `daylightHours(date, {lat,lon})` alimenta el filtro de horas de luz del
      panel (`scoreDay/scoreDays`) y las salidas diurnas / "llegada de noche" del cruce
      (`planCrossing`, opción `location`). Sin `location` cae a `DAYLIGHT` fijo (tests). Offset
      UTC−3 fijo (RdlP, sin DST).
- [ ] Routing con **isócronas** (hoy es derrota fija sobre varias horas de salida).
- [ ] Enlazar/parsear el **modelo oficial de altura del SHN** en alertas.

### Validación del pronóstico (medido el 2026-07-30, 147 snapshots / 934 comparaciones)

Estado: el pronóstico **físico está bien** (viento 0,6 kt de MAE a +0d, 2,3 kt a +6d, sesgo
≈0). El **semáforo** da 78% en decisión (seguro vs peligroso), 70% en severidad y 60% en
etiqueta exacta, con **18% de fallos peligrosos** (dijo seguro, salió peligroso). Detalle y
metodología en `validar_pronostico.txt` y en https://regatas.com.ar/validacion/ .

- [ ] **Bajar los fallos por NIEBLA. Es lo único que mueve la aguja**: 43% de los fallos
      peligrosos y **29 de los 31 rojos perdidos**. El recall de niebla contra reanálisis es
      58%. Requiere serie METAR (abajo) para calibrar contra dato medido y no contra ERA5.
- [ ] **Revisar `gustYellow` / `rainYellow`** (`src/lib/config/boat.ts`). Los fallos por
      ráfaga caen **todos** en 25-29 kt con el umbral en 25, y los de lluvia en 2,3-3,5 mm con
      el umbral en 2: o sea justo **dentro del error de medición** (MAE de ráfaga ~3 kt). Una
      banda o histéresis limpiaría ruido sin perder señal. **Barato y no depende de juntar
      más datos** → es lo primero que conviene hacer.
- [ ] **Que `metar-eval.mjs report` lea `validation/metar-observado.jsonl`** en vez de la API
      en vivo (con fallback). Hoy el acumulador se llena por cron pero **nadie lo consume**,
      así que la validación de niebla sigue limitada a la ventana corta. Rinde recién con
      varias semanas juntadas (~fin de agosto 2026).
- [ ] **Sudestada / bajante: sin validar.** Cero eventos observados en 5 semanas. No es un
      bug a arreglar, es esperar a que pase una de verdad.
- [ ] **Fragilidad del pipeline:** la retención real de aviationweather.gov es **~3-4 días**
      (aunque se pidan 168 h), y los snapshots de pronóstico tampoco se pueden regenerar. Si
      la máquina queda apagada una semana, esos datos se pierden para siempre. Conviene
      mirar `validation/snapshot.log` cada tanto, o mover el cron a algo siempre encendido.

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
  (hoy `schema-13`) o la app crashea con caché viejo. Ya pasó varias veces.
- **Preview:** `output: export` → `next start` no sirve; usar `npx serve out`. Sin HMR
  (rebuild para ver cambios). Matar servers `serve` zombies con `pkill -f "serve out"`.
- **Git:** se trabaja y pushea en `main`. El usuario pidió **consultar antes de commit/push**.
  `run.sh`, `run_mock.sh`, `pendiente.txt` y `validar_pronostico.txt` van sin trackear (ya
  están en `.gitignore`).
- **Ops de validación (`scripts/`, `validation/`):** el cron de las 6:10 corre
  `scripts/snapshot-diario.sh`, que captura el pronóstico de las 6 zonas **y** la serie
  horaria METAR. Los `validation/*.json` y `metar-observado.jsonl` **se versionan porque NO
  se pueden regenerar** (Open-Meteo no devuelve el pronóstico que emitió tal día). El
  dashboard se genera en `public/validacion/index.html` → se publica en
  **regatas.com.ar/validacion/**; el cron actualiza los datos pero **no** la página: hay que
  regenerarla y commitearla. Guía de uso: `validar_pronostico.txt`.
  Ojo: `snapshot-diario.sh` **no rehace** la captura si ya hay una de hoy (`FORZAR=1` para
  pisarla) — correrlo a la tarde reemplazaría el pronóstico de la mañana por datos que para
  el día +0 ya son casi observación, inflando el acierto.
- **METAR (aviación) como observación real de visibilidad** para la niebla (el pronóstico es
  flojo). **Fase A hecha:** parser/normalizador de dominio puro (`src/lib/domain/metar.ts` +
  tests) y validador de niebla contra METAR observado (`scripts/metar-eval.mjs report`, ya
  versionado; aviationweather.gov dice 7 días de historia pero **devuelve ~3-4**, por eso el
  cron acumula la serie horaria en `validation/metar-observado.jsonl`). Primer resultado: ~79% de aciertos de nivel de
  niebla y 4 subestimaciones (pronóstico "despejado" con niebla real, mañana del 2026-06-30).
  Aprendizaje: **la visibilidad manda**, MIFG/BCFG (niebla superficial) con buena visibilidad NO
  es niebla navegable. **Fase B hecha (producto):** el panel muestra "Visibilidad observada ahora"
  del aeropuerto más cercano (`MetarObservation` + `useMetarObservation` + `services/metar.ts` +
  catálogo `config/metarStations.ts`); es solo dato de hoy, NO entra al scoring. El fetch va al
  proxy propio `api.regatas.com.ar/metar` (Cloudflare **Worker** en `worker/`, porque la API no
  trae CORS). El Worker va en **subdominio propio** (Custom Domain), no en la ruta del apex,
  porque el sitio (GitHub Pages) tiene el apex en **DNS-only** (no proxeado por Cloudflare), así
  que una Route no lo interceptaría; la llamada es cross-origin y el Worker responde con CORS.
  Deploy: `cd worker && npx wrangler deploy` (crea el subdominio). Si no está, la tarjeta no
  aparece (degrada). Cobertura floja en Colonia/Carmelo (METAR irregular).
