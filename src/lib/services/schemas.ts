import { z } from 'zod';

/** Respuesta de Open-Meteo Forecast API (subset que usamos). */
export const openMeteoForecastSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number()),
    wind_speed_10m: z.array(z.number()),
    wind_gusts_10m: z.array(z.number()),
    wind_direction_10m: z.array(z.number()),
    precipitation: z.array(z.number()),
    visibility: z.array(z.number().nullable()).optional(),
    cloud_cover: z.array(z.number().nullable()).optional(),
  }),
});
export type OpenMeteoForecast = z.infer<typeof openMeteoForecastSchema>;

/** Respuesta de Open-Meteo Marine API (subset). */
export const openMeteoMarineSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    sea_level_height_msl: z.array(z.number().nullable()).optional(),
    wave_height: z.array(z.number().nullable()).optional(),
  }),
});
export type OpenMeteoMarine = z.infer<typeof openMeteoMarineSchema>;

/** Observaciones puntuales crudas de la API a5 del INA. */
export const inaObservacionesSchema = z.array(
  z.object({
    timestart: z.string(),
    valor: z.number().nullable(),
  }),
);
export type InaObservaciones = z.infer<typeof inaObservacionesSchema>;

/** Respuesta normalizada del nivel de agua observado (forma simplificada tipo INA). */
export const waterLevelSchema = z.object({
  stationName: z.string(),
  series: z.array(
    z.object({
      time: z.string(),
      heightM: z.number(),
    }),
  ),
});
export type WaterLevelResponse = z.infer<typeof waterLevelSchema>;
