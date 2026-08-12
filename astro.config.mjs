import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Build sin optimizaciones agresivas: HTML/JS/CSS legibles, sourcemaps on.
export default defineConfig({
  integrations: [react()],
  i18n: {
    locales: ['es', 'en'],
    defaultLocale: 'es',
    routing: {
      prefixDefaultLocale: true,
    },
  },
  compressHTML: false,
  build: {
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      minify: false,
      cssMinify: false,
      sourcemap: true,
      cssCodeSplit: false,
      reportCompressedSize: false,
      assetsInlineLimit: 0,
      modulePreload: false,
      target: 'esnext',
      rollupOptions: {
        output: {
          compact: false,
          minifyInternalExports: false,
          // Evita partir Three/React en chunks agresivos
          manualChunks: undefined,
        },
      },
    },
    esbuild: {
      minify: false,
      legalComments: 'inline',
    },
    ssr: {
      noExternal: ['three'],
    },
  },
});
