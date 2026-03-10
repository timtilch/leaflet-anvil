/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/index.ts'],
        },
    },
    build: {
        lib: {
            entry: 'src/index.ts',
            name: 'LeafletAnvil',
            fileName: (format) => `leaflet-anvil.${format === 'es' ? 'js' : 'umd.js'}`,
        },
        rollupOptions: {
            external: ['leaflet'],
            output: {
                globals: {
                    leaflet: 'L',
                },
            },
        },
    },
});

