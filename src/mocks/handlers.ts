import type {
  OpenMeteoForecast,
  OpenMeteoMarine,
  WaterLevelResponse,
} from '@/lib/services/schemas';

/**
 * Generador determinístico de datos de ejemplo con forma de Open-Meteo / INA.
 * Cubre un patrón de 7 días con: días buenos, una sudestada (viento SE
 * sostenido), un día de viento fuerte y una bajante (viento NW sostenido),
 * para que el dashboard, las alertas y el planificador tengan datos con sentido.
 */

const HOURS_PER_DAY = 24;
const DAYS = 7;

const pad = (n: number) => String(n).padStart(2, '0');

function startMidnightToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isoLocal(base: Date, hourOffset: number): string {
  const d = new Date(base.getTime() + hourOffset * 3600_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(
    d.getUTCHours(),
  )}:00`;
}

interface DayPattern {
  baseWind: number;
  gustExtra: number;
  dir: number;
  rain: number;
  tempBase: number;
  /** Si está, hay niebla matinal con esta visibilidad mínima (m). */
  fogVisM?: number;
  /** Nubosidad media del día (0..100 %). */
  cloud: number;
}

// Patrón por día (índice 0 = hoy).
const PATTERN: DayPattern[] = [
  { baseWind: 11, gustExtra: 5, dir: 270, rain: 0, tempBase: 15, cloud: 10 }, // verde · soleado
  { baseWind: 23, gustExtra: 6, dir: 135, rain: 3, tempBase: 14, cloud: 95 }, // sudestada · lluvia
  { baseWind: 30, gustExtra: 9, dir: 200, rain: 1, tempBase: 12, cloud: 80 }, // rojo · lluvia parcial
  { baseWind: 7, gustExtra: 4, dir: 90, rain: 0, tempBase: 16, fogVisM: 3000, cloud: 85 }, // neblina · nublado
  { baseWind: 22, gustExtra: 5, dir: 315, rain: 0, tempBase: 13, cloud: 45 }, // bajante · parcial
  { baseWind: 19, gustExtra: 6, dir: 180, rain: 0, tempBase: 15, cloud: 75 }, // amarillo · nublado
  { baseWind: 12, gustExtra: 5, dir: 250, rain: 0, tempBase: 17, fogVisM: 500, cloud: 20 }, // niebla · soleado
];

function buildSeries() {
  const base = startMidnightToday();
  const time: string[] = [];
  const wind: number[] = [];
  const gust: number[] = [];
  const dir: number[] = [];
  const precip: number[] = [];
  const temp: number[] = [];
  const vis: number[] = [];
  const cloud: number[] = [];
  const seaLevel: number[] = [];

  const CLEAR_VIS = 24000; // visibilidad "despejada" en metros

  for (let day = 0; day < DAYS; day++) {
    const p = PATTERN[day];
    for (let h = 0; h < HOURS_PER_DAY; h++) {
      const offset = day * HOURS_PER_DAY + h;
      // Variación diurna suave del viento (más a la tarde).
      const diurnal = Math.sin(((h - 6) / 24) * Math.PI * 2) * 3;
      const w = Math.max(2, Math.round((p.baseWind + diurnal) * 10) / 10);
      time.push(isoLocal(base, offset));
      wind.push(w);
      gust.push(Math.round((w + p.gustExtra) * 10) / 10);
      dir.push(p.dir);
      precip.push(h >= 8 && h <= 16 ? p.rain : 0);
      temp.push(Math.round((p.tempBase + Math.sin(((h - 9) / 24) * Math.PI * 2) * 4) * 10) / 10);
      // Niebla matinal: visibilidad baja entre las 5 y las 9, se disipa hacia las 11.
      let v = CLEAR_VIS;
      if (p.fogVisM != null) {
        if (h >= 5 && h <= 9) v = p.fogVisM;
        else if (h === 10) v = Math.round((p.fogVisM + CLEAR_VIS) / 2);
      }
      vis.push(v);
      // Nubosidad: base del día + leve variación diurna, acotada a 0..100.
      cloud.push(Math.max(0, Math.min(100, Math.round(p.cloud + Math.sin((h / 24) * Math.PI * 2) * 8))));
      // Nivel del mar: sube con sudestada (día 1), baja con bajante (día 4).
      const tide = Math.sin((h / 12) * Math.PI) * 0.3; // marea astronómica chica
      let surge = 0;
      if (day === 1) surge = 0.4 + h * 0.02;
      if (day === 4) surge = -(0.3 + h * 0.015);
      seaLevel.push(Math.round((tide + surge) * 100) / 100);
    }
  }

  return { time, wind, gust, dir, precip, temp, vis, cloud, seaLevel };
}

export function mockForecast(lat: number, lon: number): OpenMeteoForecast {
  const s = buildSeries();
  return {
    latitude: lat,
    longitude: lon,
    timezone: 'America/Argentina/Buenos_Aires',
    hourly: {
      time: s.time,
      temperature_2m: s.temp,
      wind_speed_10m: s.wind,
      wind_gusts_10m: s.gust,
      wind_direction_10m: s.dir,
      precipitation: s.precip,
      visibility: s.vis,
      cloud_cover: s.cloud,
    },
  };
}

export function mockMarine(): OpenMeteoMarine {
  const s = buildSeries();
  return {
    hourly: {
      time: s.time,
      sea_level_height_msl: s.seaLevel,
      wave_height: s.seaLevel.map((v) => Math.max(0.2, 0.4 + Math.abs(v))),
    },
  };
}

export function mockWaterLevel(): WaterLevelResponse {
  const base = startMidnightToday();
  // Últimas 12 horas observadas, con tendencia a subir (coherente con sudestada incipiente).
  const series = Array.from({ length: 12 }, (_, i) => ({
    time: isoLocal(base, i),
    heightM: Math.round((1.2 + i * 0.04 + Math.sin(i / 3) * 0.1) * 100) / 100,
  }));
  return { stationName: 'San Fernando (INA, ejemplo)', series };
}
