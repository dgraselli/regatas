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

- **Tres features completas**:
  - Panel `/` con semáforo 🟢🟡🔴 por día (viento/ráfagas/lluvia/surge).
  - Alertas `/alertas`: sudestada/bajante + nivel de agua observado.
  - Cruce `/cruce`: rankea horas de salida entre dos lugares según viento, con la
    polar del barco activo (rumbo, amura, velocidad y ETA por tramo + advertencias).
- **Perfil de usuario** `/perfil`: alta/baja/selección de barcos y lugares + nivel de
  tolerancia (prudente/normal/audaz). Persistencia en localStorage (`useProfile`).
- **Polar generada por eslora** (`polarModel.ts`): cualquier barco recibe una polar
  aproximada (velocidad de casco ≈ 1.34·√LWL) + parámetros de navegación por tamaño.
- **Datos**: Open-Meteo (viento/clima/marine) e INA (nivel), con **switch de mocks**
  (`NEXT_PUBLIC_USE_MOCKS`) para correr build/tests/dev **sin red**.
- **36 tests** en verde. `tsc`, `lint` y `build` OK. PWA instalable + offline.

## Arquitectura (mapa de archivos)

```
src/
  app/                 page (/), alertas/, cruce/, perfil/, layout, providers
  components/          dashboard/ · alerts/ · crossing/ · common/ · ui/
  lib/
    domain/   (PURO, testeado) scoring · surge · polar · polarModel · routing · geo · pointOfSail
    profile/  types · defaults · ProfileContext (localStorage, useProfile)
    services/ http (switch mocks) · openMeteoForecast · openMeteoMarine · inaHidrologico · index (facade) · schemas
    transforms/ normalizeForecast · normalizeWaterLevel
    hooks/    useForecast · useWaterLevel · useCrossingPlan
    config/   boat (umbrales, scoringFor) · routes (buildRoute)
    types/    config · forecast · water · crossing
    format.ts
  mocks/      handlers (generador determinístico de fixtures)
tests/        geo · polar · polarModel · scoring · surge · routing
```

Reglas: todo el fetch externo ocurre **en el cliente**; el dominio es **puro** (sin I/O)
y está cubierto por tests; los datos del usuario viven en localStorage.

## Comandos

```bash
npm install
npm run dev      # http://localhost:3000  (usa mocks por defecto)
npm test         # 36 tests de dominio (sin red)
npm run build    # build de producción
npm run lint
npx tsc --noEmit # typecheck
```

Para usar APIs reales: poné `NEXT_PUBLIC_USE_MOCKS=false` en `.env.local`.

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
- El entorno remoto puede no tener egress: por eso los mocks. Si se prueba con APIs
  reales, hacerlo en un navegador real (no en el build).
- Mantener el dominio **puro y testeado**: cualquier lógica nueva de cálculo va en
  `src/lib/domain/` con su test en `tests/`.
- Rama de trabajo: `claude/sailing-weather-planner-s9atbe`.
