/**
 * Clubes náuticos y puertos deportivos conocidos del Río de la Plata, para
 * cargarlos como lugares con un clic en el perfil. Coordenadas aproximadas
 * (nivel club/puerto, ±~1 km) — suficientes para muestrear el pronóstico, no
 * para usar como punto de amarre exacto.
 */
export interface KnownClub {
  name: string;
  lat: number;
  lon: number;
  country: 'AR' | 'UY';
}

export const KNOWN_CLUBS: KnownClub[] = [
  // Argentina — norte → sur
  { name: 'Yacht Club Buenos Aires (San Fernando)', lat: -34.408, lon: -58.566, country: 'AR' },
  { name: 'Club San Fernando', lat: -34.425, lon: -58.56, country: 'AR' },
  { name: 'Club Náutico Albatros (Victoria)', lat: -34.43, lon: -58.553, country: 'AR' },
  { name: 'Boating Club (Beccar)', lat: -34.458, lon: -58.52, country: 'AR' },
  { name: 'Club de Pesca y Náutica Las Barrancas (Acassuso)', lat: -34.474, lon: -58.495, country: 'AR' },
  { name: 'Club Náutico San Isidro', lat: -34.473, lon: -58.503, country: 'AR' },
  { name: 'Club de Veleros San Isidro', lat: -34.47, lon: -58.505, country: 'AR' },
  { name: 'Yacht Club San Isidro', lat: -34.468, lon: -58.506, country: 'AR' },
  { name: 'Club Náutico Buchardo (San Isidro)', lat: -34.469, lon: -58.504, country: 'AR' },
  { name: 'Club Náutico Olivos', lat: -34.508, lon: -58.477, country: 'AR' },
  { name: 'Yacht Club Olivos', lat: -34.506, lon: -58.478, country: 'AR' },
  { name: 'Yacht Club Argentino (Dársena Norte)', lat: -34.585, lon: -58.363, country: 'AR' },
  { name: 'Yacht Club Puerto Madero', lat: -34.61, lon: -58.363, country: 'AR' },
  { name: 'Club Náutico Quilmes', lat: -34.71, lon: -58.25, country: 'AR' },
  // La Plata (Ensenada / Berisso / Punta Lara)
  { name: 'Club Universitario de La Plata (Punta Lara)', lat: -34.808, lon: -57.987, country: 'AR' },
  { name: 'Club Náutico Ensenada', lat: -34.86, lon: -57.91, country: 'AR' },
  { name: 'Club de Regatas La Plata (Ensenada)', lat: -34.858, lon: -57.905, country: 'AR' },
  { name: 'Club Náutico Ciudad de Berisso', lat: -34.867, lon: -57.858, country: 'AR' },

  // Uruguay — oeste → este
  { name: 'Yacht Club Nueva Palmira', lat: -33.895, lon: -58.408, country: 'UY' },
  { name: 'Yacht Club Carmelo', lat: -33.997, lon: -58.293, country: 'UY' },
  { name: 'Conchillas (muelle)', lat: -34.17, lon: -58.05, country: 'UY' },
  { name: 'Puerto Sauce (Juan Lacaze)', lat: -34.435, lon: -57.452, country: 'UY' },
  { name: 'Embarcadero Riachuelo', lat: -34.433, lon: -57.72, country: 'UY' },
  { name: 'Yacht Club de Colonia', lat: -34.472, lon: -57.851, country: 'UY' },
  { name: 'Puerto del Buceo (Montevideo)', lat: -34.912, lon: -56.137, country: 'UY' },
  { name: 'Puerto de Piriápolis', lat: -34.868, lon: -55.275, country: 'UY' },
];
