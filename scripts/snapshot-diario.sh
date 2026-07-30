#!/usr/bin/env bash
# Captura diaria del pronóstico (7 días) en las 6 zonas del Río de la Plata.
# Pensado para correr por cron. Guarda en validation/forecast-<fecha>-<zona>.json
# y deja un log en validation/snapshot.log.
set -euo pipefail

# cron arranca con PATH mínimo: aseguramos node.
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

REPO="/home/chaca/workspace/ZAMBA/regatas"
cd "$REPO"

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
for z in "${ZONAS[@]}"; do
  read -r lat lon nombre <<<"$z"
  node scripts/forecast-eval.mjs capture "$lat" "$lon" "$nombre" || echo "FALLO: $nombre"
done
