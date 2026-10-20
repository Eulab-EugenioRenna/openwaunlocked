import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: {
        server: 'src/server.ts',
        client: 'src/client.ts',
        types: 'src/types.ts',
    },
    format: 'esm',
    dts: true,
    clean: true,
    deps: {
        neverBundle: [
            '@eulab/openwaunlocked-driver-interface',
            'hono',
            'hono/*',
        ],
    },
});
