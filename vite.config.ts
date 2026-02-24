import { defineConfig } from 'vite';

export default defineConfig({
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

