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

- Confirmar el contrato real de la API del INA (URL, estaciones, auth) y asociar la
  estación de nivel al lugar activo del usuario.
- Permitir cargar una polar real (medida) además de la generada por eslora.
