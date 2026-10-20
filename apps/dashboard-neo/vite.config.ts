import { defineConfig } from "vitest/config"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { devtools } from "@tanstack/devtools-vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const resolvePackageExport = createRequire(import.meta.url).resolve
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

const config = defineConfig({
  base: '/dashboard/',
  resolve: {
    tsconfigPaths: true,
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    alias: [
      // The checkout can run the dashboard before workspace packages have been
      // built. Resolve browser-safe package entry points to their TypeScript
      // sources so Vite can transpile them in the dev server.
      { find: /^@eulab\/openwaunlocked-logger$/, replacement: resolve(repoRoot, "packages/logger/src/browser.ts") },
      { find: /^@eulab\/openwaunlocked-hyperemitter$/, replacement: resolve(repoRoot, "packages/hyperemitter/src/index.ts") },
      { find: /^@eulab\/openwaunlocked-screencaster\/client$/, replacement: resolve(repoRoot, "packages/screencaster/src/client.ts") },
      { find: /^@eulab\/openwaunlocked-socket-client\/calling-platform$/, replacement: resolve(repoRoot, 'packages/socket-client/src/calling-platform.browser.ts') },
      { find: /^@eulab\/openwaunlocked-schema\/calling-media$/, replacement: resolve(repoRoot, 'packages/schema/src/calling-media.ts') },
      { find: /^@eulab\/openwaunlocked-schema\/interactive$/, replacement: resolve(repoRoot, 'packages/schema/src/interactive.ts') },
      { find: /^@eulab\/openwaunlocked-runtime-core$/, replacement: resolve(repoRoot, 'packages/runtime-core/src/index.ts') },
      { find: /^@eulab\/openwaunlocked-socket-client$/, replacement: resolve(repoRoot, "packages/socket-client/src/index.ts") },
      { find: "react/jsx-runtime", replacement: resolvePackageExport("react/jsx-runtime") },
      { find: "react/jsx-dev-runtime", replacement: resolvePackageExport("react/jsx-dev-runtime") },
      { find: "react-dom/client", replacement: resolvePackageExport("react-dom/client") },
      { find: /^react$/, replacement: resolvePackageExport("react") },
      { find: /^react-dom$/, replacement: resolvePackageExport("react-dom") },
    ],
  },
  plugins: [
    devtools(),
    tailwindcss(),
    TanStackRouterVite(),
    viteReact(),
  ],
  define: {
    'import.meta.env.VITE_EASY_API_PORT': JSON.stringify(process.env.EASY_API_PORT || ''),
    'import.meta.env.VITE_EASY_API_HOST': JSON.stringify(process.env.EASY_API_HOST || ''),
  },
  build: {
    rollupOptions: {
      external: [
        "@eulab/openwaunlocked-schema",
        "@eulab/openwaunlocked-utils",
        "@eulab/openwaunlocked-config",
        "jiti"
      ],
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE" && warning.message.includes("use client")) {
          return
        }
        warn(warning)
      },
    },
  },
  ssr: {
    noExternal: ['@eulab/openwaunlocked-utils', 'jiti']
  },
  test: {
    environment: "jsdom",
    globals: true,
  }
})

export default config
