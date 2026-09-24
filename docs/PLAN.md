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
  - **Resumen de marea**: nivel observado (SHN, respaldo INA) + tendencia + aviso de agua alta/baja para
    la amarra (usa los niveles seguros de la amarra si están definidos).
  - **Gráfico horario**: barras viento/ráfagas, **flechas de dirección** por hora, líneas de
    umbral (poco viento azul —solo si aplica—, precaución, peligro) y **bandas de
    visibilidad reducida**.
- **Alertas `/alertas`** — sudestada/bajante + **niebla/visibilidad** (con ventana horaria)
  + nivel de agua observado (SHN, respaldo INA).
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
  **cloud_cover**; marine: nivel del mar/olas) y nivel observado del SHN (vía Worker; INA de respaldo).
  **Switch de mocks**. SMN: solo referencia, no se consulta.
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
- [x] **Nivel observado desde el SHN** (2026-09-24): el INA republica los mareógrafos del
      SHN con 1–2 h de atraso; el SHN los publica minutos después de medir. Se lee el CSV
      `hidro.gov.ar/oceanografia/AlturasHorarias.asp?export=csv` vía el Worker
      (`api.regatas.com.ar/shn/alturas`, 5 min de caché) y el INA queda de respaldo.
      Pendiente: volver a medir el margen ±0.20 m del "ahora" (se midió con el atraso del
      INA) y evaluar bajar `OBSERVED_STALE_MS` de 3 h a ~2 h.
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
- [ ] **El pronóstico subestima el viento sobre el río, ~15%, de forma pareja** (medido el
      2026-09-24 con `node scripts/carp-eval.mjs historico`). Contra las estaciones de la
      CARP —las únicas que miden viento SOBRE el agua— en Pilote Norden, **11 años y 76.000
      horas** contra ERA5: cociente medido/modelo entre 1.12 y 1.27 según el año (desvío
      0.037), 1.11 en invierno y 1.19 en verano. Las otras tres estaciones dan lo mismo en
      magnitud.

      **El sesgo es PLANO, no crece con la intensidad.** Los cuantiles, que es la vista
      limpia, dan 1.12 / 1.14 / 1.15 / 1.13 / 1.12 en p50 / p75 / p90 / p95 / p99. Si se
      agrupa por el valor medido *parece* crecer (0.91 → 1.23) pero agrupando por el modelo
      *parece* decrecer (1.38 → 1.04): esa reversión es regresión a la media, no física. El
      script muestra las tres vistas juntas para que el espejismo no se pueda repetir.

      Acción posible: un factor de corrección único (~1.15) sobre el viento de Open-Meteo,
      o equivalentemente bajar los umbrales. Antes hace falta verificarlo en las zonas que
      la app realmente sirve —las cuatro estaciones de la CARP están todas en el Canal
      Martín García, ninguna frente a Buenos Aires o San Fernando— y decidir si el factor
      aplica a lugares costeros o sólo a agua abierta.
- [ ] **El "observado" del validador no registra el viento fuerte** (`node
      scripts/carp-eval.mjs referencia`). `forecast-eval.mjs` compara el pronóstico contra
      Open-Meteo `past_days`, o sea contra el mismo modelo evaluándose a sí mismo. Sobre
      1151 horas en Pilote Norden, de las **253 horas con viento real ≥ 18 kt la referencia
      registró 95 (38%)**, y de las 31 con ≥ 25 kt registró 4 (13%).

      Corrigiendo el sesgo (×1.14) la detección sube a 66% y 52%, con 40 y 7 falsas alarmas
      respectivamente: o sea que **la mitad del problema es sesgo y la otra mitad dispersión**
      (MAE 3 kt, r 0.81), que no se arregla con un factor. Mientras tanto el 78% / 70% / 60%
      de acierto del semáforo está medido contra una vara que no ve el peligro: es un techo,
      no una medición. No dice que el pronóstico sea malo, dice que no sabemos cuán bueno es
      donde importa.
- [x] **Validar toda la serie, no sólo la ventana de la API de pronóstico.** (hecho el
      2026-09-24) Open-Meteo devuelve el eje temporal completo del rango pedido pero con
      valores NULOS más allá de su retención real (~58 días con `past_days=92`). `scoreDays`
      armaba igual esos días con viento 0 y el validador los contaba como fallos: el acierto
      de viento caía de 84 % a 56 % **a medida que crecía el archivo**, una degradación
      inventada que iba a empeorar sola. Arreglado saltando los días sin dato, y el observado
      pasa a combinar el archivo **ERA5** para el grueso con la API de pronóstico para la
      cola (`fetchObservedHourly`). Se validan 2446 comparaciones sobre los 3 meses
      capturados en vez de 1616 sobre 59 días, con el mismo resultado por mes (81-88 %), que
      es la señal de que la extensión no distorsiona nada.

      **Queda una limitación**: ERA5 devuelve `visibility` entera en null, así que la
      **niebla se sigue validando sólo sobre ~58 días** (n=1570 de 2446). Es otra razón para
      terminar el consumo del `metar-observado.jsonl`, que sí tiene visibilidad medida y
      serie larga.
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
