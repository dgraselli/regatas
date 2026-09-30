#!/usr/bin/env bash
# Captura diaria del pronóstico (7 días) en las 6 zonas del Río de la Plata.
# Lo corre GitHub Actions todos los días (.github/workflows/snapshot-diario.yml),
# que commitea lo capturado; también se puede correr a mano. Guarda en
# validation/forecast-<fecha>-<zona>.json y acumula validation/metar-observado.jsonl
# y validation/nivel-observado.jsonl.
# Sale con código != 0 si alguna captura falló (lo que sí se bajó queda guardado).
set -euo pipefail

# cron arranca con PATH mínimo: aseguramos node.
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

cd "$(dirname "$0")/.."

# La fecha del snapshot es la de Buenos Aires, no la de la máquina que lo corre.
export TZ="America/Argentina/Buenos_Aires"
FALLOS=0

# zona: "lat lon Nombre"
ZONAS=(
  "-34.6     -58.37   Buenos Aires"
  "-33.997   -58.293  Carmelo"
  "-34.472   -57.851  Colonia"
  "-34.8399  -57.9234 La Plata"
  "-34.912   -56.137  Montevideo"
  "-34.433   -58.55   San Fernando"
)

echo "===== $(date '+%Y-%m-%d %H:%M:%S') captura diaria ====="

# El snapshot vale como "lo que el pronóstico decía a la mañana": correrlo de nuevo
# más tarde lo pisa con datos de la tarde, que para el día +0 ya son casi observación
# e inflan el acierto. Si ya hay captura de hoy, no se rehace (FORZAR=1 para pisarla).
HOY="$(date '+%Y-%m-%d')"
if compgen -G "validation/forecast-${HOY}-*.json" > /dev/null && [ "${FORZAR:-0}" != "1" ]; then
  echo "Ya hay captura de $HOY; no se rehace (FORZAR=1 para pisarla)."
else
  for z in "${ZONAS[@]}"; do
    read -r lat lon nombre <<<"$z"
    node scripts/forecast-eval.mjs capture "$lat" "$lon" "$nombre" || { echo "FALLO: $nombre"; FALLOS=$((FALLOS + 1)); }
  done
fi

# Observación REAL de visibilidad (METAR de aeropuertos). aviationweather.gov sólo
# dice exponer 7 días de historia pero devuelve ~3-4, así que si no se acumula día a día se pierde: esto va
# armando la serie larga para validar niebla contra dato medido y no contra
# reanálisis. Es idempotente (no duplica), así que correrlo de más es inofensivo.
echo "--- METAR (visibilidad observada) ---"
node scripts/metar-eval.mjs capture || { echo "FALLO: captura METAR"; FALLOS=$((FALLOS + 1)); }

# Nivel de agua OBSERVADO (mareógrafos del SHN): es lo que dice si una sudestada
# o bajante pronosticada se cumplió. El CSV del SHN trae ~10 días; se acumula acá.
echo "--- Nivel de agua observado (SHN) ---"
node scripts/nivel-eval.mjs capture || { echo "FALLO: captura nivel SHN"; FALLOS=$((FALLOS + 1)); }

if [ "$FALLOS" -gt 0 ]; then
  echo "$FALLOS captura(s) fallida(s)."
  exit 1
fi
