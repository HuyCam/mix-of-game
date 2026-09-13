import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL('..', import.meta.url)),
  plugins: command === 'serve' ? [{
    name: 'soccer-source-entry',
    transformIndexHtml(html: string) {
      return html.replace('<script src="soccer/soccer.bundle.js"></script>', '<script type="module" src="/soccer/src/main.ts"></script>');
    },
  }] : [],
  build: {
    outDir: here, emptyOutDir: false,
    lib: { entry: `${here}src/main.ts`, name: 'ArcadeSoccer', formats: ['iife'], fileName: () => 'soccer.bundle.js' },
    minify: 'esbuild', sourcemap: false,
  },
}));
