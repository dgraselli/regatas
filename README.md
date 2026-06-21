# Regatas — Asistente náutico

App (web + PWA instalable) para evaluar de un vistazo si los próximos días son
recomendables para actividades náuticas (sailing, etc.) en el Río de la Plata,
y para planificar el cruce **La Plata → Colonia** en velero.

## Funcionalidades

- **Multiusuario sin registro**: cada usuario carga sus barcos y lugares en
  **Mi perfil**; se guardan solo en el navegador (localStorage). La polar del barco
  se genera a partir de su eslora, y un nivel de tolerancia (prudente/normal/audaz)
  ajusta los umbrales del semáforo.
- **Panel + semáforo** 🟢🟡🔴: pronóstico de viento/clima de los próximos días con
  un indicador simple de "conviene o no salir", según el lugar y barco activos.
- **Alertas de marea**: detecta **sudestadas** (viento SE sostenido → sube el agua,
  riesgo de inundar el club) y **bajantes** (viento N/NW sostenido → baja el agua,
  riesgo de varadura), estimadas según dirección y persistencia del viento más el
  nivel observado.
- **Planificador de cruce**: entre dos lugares del usuario (p.ej. La Plata → Colonia),
  evalúa la derrota a distintas horas de salida y sugiere la mejor según el viento
  (rumbo, amura, velocidad y ETA por tramo, con advertencias), usando la polar del
  barco activo.

## Rumbos del viento

La app muestra la dirección del viento con la **rosa de 16 rumbos en español**
(`compass()` en `src/lib/format.ts`). La dirección indica **de dónde viene** el viento
(no hacia dónde va). Por ejemplo, **OSO = Oeste-Sudoeste (~247,5°)**.

| Sigla | Nombre | ° aprox. | | Sigla | Nombre | ° aprox. |
|---|---|---|---|---|---|---|
| N   | Norte         | 0     | | S   | Sur            | 180   |
| NNE | Nor-noreste   | 22,5  | | SSO | Sud-sudoeste   | 202,5 |
| NE  | Noreste       | 45    | | SO  | Sudoeste       | 225   |
| ENE | Este-noreste  | 67,5  | | OSO | Oeste-sudoeste | 247,5 |
| E   | Este          | 90    | | O   | Oeste          | 270   |
| ESE | Este-sudeste  | 112,5 | | ONO | Oeste-noroeste | 292,5 |
| SE  | Sudeste       | 135   | | NO  | Noroeste       | 315   |
| SSE | Sud-sudeste   | 157,5 | | NNO | Nor-noroeste   | 337,5 |

**Relación con las alertas de marea** (ver `SURGE` en `src/lib/config/boat.ts`):

- Viento del **SE** (112°–157°) sostenido → **sudestada**: sube el agua (riesgo de inundar el club).
- Viento del **N / NO** (292°–22°) sostenido → **bajante**: baja el agua (riesgo de varadura).
- El resto de los rumbos (p. ej. **OSO**, que cae entre ambos sectores) **no** dispara
  alertas de marea, aunque sí puede afectar el semáforo por intensidad o ráfagas.

## Stack

Next.js (App Router) + TypeScript + Tailwind · TanStack Query (caché/offline) ·
Zod (validación) · Vitest (tests del dominio).

## Fuentes de datos

- **Viento/clima**: [Open-Meteo Forecast API](https://open-meteo.com/) (gratis, sin API key).
- **Olas / nivel del mar**: Open-Meteo Marine API (pista, grilla gruesa).
- **Nivel de agua observado**: INA — Sistema de Alerta Hidrológico, API pública "a5"
  (`https://alerta.ina.gob.ar/a5`, sin API key, con CORS). Se usa la serie de altura
  hidrométrica de la estación más cercana al lugar activo; ver
  `src/lib/services/inaHidrologico.ts` y `src/lib/config/inaStations.ts`.
- **Pronóstico oficial de sudestadas**: SHN — se enlaza/cita (no tiene API pública).

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tests del dominio (sin red)
npm run build      # build de producción
```

### Datos de ejemplo (offline)

Con `NEXT_PUBLIC_USE_MOCKS=true` (default, ver `.env.example`) la app usa datos de
ejemplo generados localmente, por lo que funciona **sin acceso a red** (ideal para
dev, tests y build). Poné `false` para que el navegador llame a las APIs reales.

## Arquitectura

- `src/lib/domain/` — lógica pura y testeada: `scoring` (semáforo), `surge`
  (sudestada/bajante), `polar` + `polarModel` (velocidad del barco / polar por eslora),
  `routing` (planificador), `geo`, `pointOfSail`.
- `src/lib/profile/` — perfil del usuario (barcos/lugares) con persistencia en
  localStorage y contexto de React (`useProfile`).
- `src/lib/services/` — borde de red (Open-Meteo / INA) con switch de mocks.
- `src/lib/config/` — umbrales del semáforo, derivación de la polar y constructor de rutas.
- `src/app/` — páginas: `/` (panel), `/alertas`, `/cruce`, `/perfil`.

> Las estimaciones son orientativas. Verificá siempre el pronóstico oficial
> (SMN / SHN) antes de navegar.

## Pendientes

- Ampliar/curar el listado de estaciones del INA (`inaStations.ts`) y, si hace falta,
  resolver la serie de altura por cercanía consultando el catálogo en vez de la lista fija.
- Permitir cargar una polar real (medida) además de la generada por eslora.
