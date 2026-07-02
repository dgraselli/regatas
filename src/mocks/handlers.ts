import type {
  OpenMeteoForecast,
  OpenMeteoMarine,
  WaterLevelResponse,
} from '@/lib/services/schemas';
import type { MetarRaw } from '@/lib/domain/metar';

/**
 * Generador determinístico de datos de ejemplo con forma de Open-Meteo / INA.
 * Cubre un patrón de 7 días con: días buenos, una sudestada (viento SE
 * sostenido), un día de viento fuerte y una bajante (viento NW sostenido),
 * casos de niebla, y casos de OLAS (día 6 con poco viento pero mar de fondo
 * grande → olas grandes → rojo, con dirección/período para ver cabeceo/balanceo
 * en el cruce), para que el dashboard, las alertas y el planificador tengan
 * datos con sentido.
 */

const HOURS_PER_DAY = 24;
const DAYS = 7; // = PATTERN.length

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
  /** Ventana de niebla: horas (inclusive) y visibilidad mínima (m) en ese rango. */
  fog?: { from: number; to: number; visM: number };
  /** Nubosidad media del día (0..100 %). */
  cloud: number;
  /** Altura de ola significativa pico del día (m). Umbrales normal: 1.0 / 1.75 m. */
  wave: number;
  /** Dirección de procedencia de la ola (grados). */
  waveDir: number;
  /** Período medio de la ola (s). <5 s = mar corta y empinada. */
  wavePeriod: number;
}

// Patrón por día (índice 0 = hoy). Solo hay 7 días (forecast_days=7), así que los
// casos de niebla viven dentro de esa ventana para que se vean en el panel.
const PATTERN: DayPattern[] = [
  { baseWind: 11, gustExtra: 5, dir: 270, rain: 0, tempBase: 15, cloud: 10, wave: 0.4, waveDir: 200, wavePeriod: 4 }, // verde · soleado
  { baseWind: 23, gustExtra: 6, dir: 135, rain: 3, tempBase: 14, cloud: 95, wave: 1.2, waveDir: 135, wavePeriod: 6 }, // sudestada · lluvia · olas moderadas → rojo (por viento/lluvia)
  { baseWind: 12, gustExtra: 5, dir: 250, rain: 0, tempBase: 17, fog: { from: 7, to: 8, visM: 500 }, cloud: 20, wave: 0.5, waveDir: 220, wavePeriod: 4 }, // niebla densa CORTA (2 h) → "Niebla temporal a primera hora" (verde)
  { baseWind: 10, gustExtra: 4, dir: 90, rain: 0, tempBase: 16, fog: { from: 7, to: 9, visM: 3000 }, cloud: 85, wave: 0.5, waveDir: 100, wavePeriod: 4 }, // neblina liviana → "Neblina temporal a primera hora" (verde)
  { baseWind: 22, gustExtra: 5, dir: 315, rain: 0, tempBase: 13, cloud: 45, wave: 1.1, waveDir: 315, wavePeriod: 5 }, // bajante · parcial · olas moderadas
  { baseWind: 12, gustExtra: 5, dir: 270, rain: 0, tempBase: 16, fog: { from: 15, to: 19, visM: 600 }, cloud: 30, wave: 0.6, waveDir: 240, wavePeriod: 4 }, // niebla densa LARGA (5 h) por la tarde → precaución (amarillo)
  { baseWind: 5, gustExtra: 3, dir: 90, rain: 0, tempBase: 17, cloud: 60, wave: 2.0, waveDir: 135, wavePeriod: 9 }, // poco viento pero mar de fondo GRANDE (swell SE, período largo) → "Olas grandes" → rojo (único driver)
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
  const wave: number[] = [];
  const waveDir: number[] = [];
  const wavePeriod: number[] = [];

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
      // Niebla en la ventana [from, to]; despejado fuera de ella.
      let v = CLEAR_VIS;
      if (p.fog != null) {
        if (h >= p.fog.from && h <= p.fog.to) v = p.fog.visM;
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
      // Ola: pico del día con leve variación diurna (más ola a la tarde). El scoring
      // toma el máximo en horas de luz, así que el pico queda ~p.wave.
      const waveDiurnal = Math.sin(((h - 9) / 24) * Math.PI * 2) * (p.wave * 0.12);
      wave.push(Math.max(0.2, Math.round((p.wave + waveDiurnal) * 100) / 100));
      waveDir.push(p.waveDir);
      wavePeriod.push(p.wavePeriod);
    }
  }

  return { time, wind, gust, dir, precip, temp, vis, cloud, seaLevel, wave, waveDir, wavePeriod };
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
      wave_height: s.wave,
      wave_direction: s.waveDir,
      wave_period: s.wavePeriod,
    },
  };
}

/** Observación METAR de ejemplo (visibilidad buena, aire algo húmedo) para el aeropuerto dado. */
export function mockMetar(icao: string): MetarRaw[] {
  const now = new Date();
  const reportTime = new Date(now.getTime() - now.getUTCMinutes() * 60_000).toISOString();
  return [
    {
      icaoId: icao,
      name: `${icao} (ejemplo)`,
      reportTime,
      temp: 12,
      dewp: 6,
      wspd: 8,
      visib: '6+',
      wxString: null,
      fltCat: 'VFR',
    },
  ];
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
