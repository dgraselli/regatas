# Regatas — Asistente náutico

App (web + PWA instalable) para evaluar de un vistazo si los próximos días son
recomendables para actividades náuticas (sailing, etc.) en el Río de la Plata,
y para planificar el cruce **La Plata → Colonia** en velero.

## Funcionalidades

- **Panel + semáforo** 🟢🟡🔴: pronóstico de viento/clima de los próximos días con
  un indicador simple de "conviene o no salir".
- **Alertas de marea**: detecta **sudestadas** (viento SE sostenido → sube el agua,
  riesgo de inundar el club) y **bajantes** (viento N/NW sostenido → baja el agua,
  riesgo de varadura), estimadas según dirección y persistencia del viento más el
  nivel observado.
- **Planificador del cruce La Plata → Colonia**: evalúa la derrota a distintas horas
  de salida y sugiere la mejor según el viento (rumbo, amura, velocidad y ETA por
  tramo, con advertencias).

## Stack

Next.js (App Router) + TypeScript + Tailwind · TanStack Query (caché/offline) ·
Zod (validación) · Vitest (tests del dominio).

## Fuentes de datos

- **Viento/clima**: [Open-Meteo Forecast API](https://open-meteo.com/) (gratis, sin API key).
- **Olas / nivel del mar**: Open-Meteo Marine API (pista, grilla gruesa).
- **Nivel de agua observado**: INA "Alerta Hidrológico Cuenca del Plata" (integración
  real pendiente de confirmar el contrato de la API; ver `src/lib/services/inaHidrologico.ts`).
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
  (sudestada/bajante), `polar` (velocidad del barco), `routing` (planificador),
  `geo`, `pointOfSail`.
- `src/lib/services/` — borde de red (Open-Meteo / INA) con switch de mocks.
- `src/lib/config/` — clubs, ruta del cruce y polar/umbrales del barco (ajustables).
- `src/app/` — páginas: `/` (panel), `/alertas`, `/cruce`.

> Las estimaciones son orientativas. Verificá siempre el pronóstico oficial
> (SMN / SHN) antes de navegar.

## Pendientes

- Confirmar el contrato real de la API del INA (URL, estaciones, auth).
- Ajustar coordenadas del club de salida y la polar real del velero.
