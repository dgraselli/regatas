import type { WaterLevelStatus } from '@/lib/types/water';
import type { WaterLevelResponse } from '@/lib/services/schemas';

function trendOf(series: { heightM: number }[]): WaterLevelStatus['trend'] {
  if (series.length < 2) return 'estable';
  const n = Math.min(4, series.length);
  const recent = series.slice(-n);
  const delta = recent[recent.length - 1].heightM - recent[0].heightM;
  if (delta > 0.05) return 'subiendo';
  if (delta < -0.05) return 'bajando';
  return 'estable';
}

export function normalizeWaterLevel(
  res: WaterLevelResponse,
  fetchedAt: string,
): WaterLevelStatus {
  const observations = res.series.map((s) => ({ time: s.time, heightM: s.heightM }));
  return {
    stationName: res.stationName,
    observations,
    trend: trendOf(observations),
    fetchedAt,
  };
}
