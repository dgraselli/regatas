/** @type {import('next').NextConfig} */
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// En GitHub Pages la app se sirve desde https://<usuario>.github.io/regatas/,
// así que en producción necesita basePath/assetPrefix. En dev queda en la raíz.
const basePath = process.env.NODE_ENV === 'production' ? '/regatas' : '';

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
