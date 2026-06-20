import { USE_MOCKS } from '@/lib/services/http';
import { waterLevelSchema, type WaterLevelResponse } from '@/lib/services/schemas';
import { mockWaterLevel } from '@/mocks/handlers';

/**
 * Nivel de agua observado (verdad ahora) del INA — "Alerta Hidrológico Cuenca
 * del Plata". La API real expone series por estación; los parámetros exactos
 * (URL base, IDs de estación, token) deben confirmarse en el portal del INA:
 * https://alerta.ina.gob.ar  —  por ahora con mocks activos se usa el ejemplo.
 *
 * TODO: completar el endpoint real cuando se confirme el contrato de la API.
 */
export async function fetchWaterLevel(_stationId?: string): Promise<WaterLevelResponse> {
  if (USE_MOCKS) {
    return waterLevelSchema.parse(mockWaterLevel());
  }
  // Integración real pendiente de confirmar contrato del INA.
  // Mientras tanto, devolvemos el ejemplo para no romper el flujo.
  return waterLevelSchema.parse(mockWaterLevel());
}
