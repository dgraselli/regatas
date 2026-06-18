import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta náutica
        mar: {
          50: '#eff8ff',
          100: '#dbeefe',
          200: '#bfe2fe',
          300: '#93d0fd',
          400: '#60b5fa',
          500: '#3b97f6',
          600: '#2579eb',
          700: '#1d63d8',
          800: '#1e51af',
          900: '#1e478a',
          950: '#172d54',
        },
        semaforo: {
          verde: '#16a34a',
          amarillo: '#eab308',
          rojo: '#dc2626',
        },
      },
    },
  },
  plugins: [],
};

export default config;
