/** @type {import('next').NextConfig} */
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Con dominio propio (regatas.com.ar) el sitio se sirve en la RAÍZ, así que el
// basePath va vacío. Si alguna vez se publica bajo un subdirectorio (p.ej.
// usuario.github.io/regatas), setear NEXT_PUBLIC_BASE_PATH=/regatas en el build.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig = {
  reactStrictMode: true,
  // Export estático: genera la carpeta `out/` para hosting estático (GitHub Pages).
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  // Sin servidor de imágenes en export estático.
  images: { unoptimized: true },
  // Genera /ruta/index.html (rutas robustas en GitHub Pages).
  trailingSlash: true,
  // Disponible en el cliente: basePath (service worker) y versión (UI + feedback).
  env: { NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_APP_VERSION: pkg.version },
};

export default nextConfig;
