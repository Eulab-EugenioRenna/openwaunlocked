# @eulab/openwaunlocked-hyperemitter














## 5.6.6
<sub>2026-10-16</sub>

-  *(patch)*
  Publish a native ESM HyperEmitter entrypoint so Bun can import the ESM core without requiring an asynchronously loading Effect module through a CommonJS dependency. Found by the expanded packaged startup tests for [#3559](https://github.com/open-wa/wa-automate-nodejs/issues/3559).

## 5.6.5
<sub>2026-10-16</sub>

- *(patch)* Version bump from group with `@eulab/openwaunlocked-core` v5.6.5

## 5.6.4
<sub>2026-10-16</sub>

- *(patch)* Version bump from group with `@eulab/openwaunlocked-api` v5.6.4, `@eulab/openwaunlocked-stickers` v5.6.4

## 5.6.3
<sub>2026-10-16</sub>

- *(patch)* Version bump from group with `@eulab/openwaunlocked-stickers` v5.6.3

## 5.6.2
<sub>2026-10-15</sub>

- *(patch)* Version bump from group with `@eulab/openwaunlocked-api` v5.6.2, `@eulab/openwaunlocked-client` v5.6.2, `@eulab/openwaunlocked-core` v5.6.2, `@eulab/openwaunlocked-logger` v5.6.2, `@eulab/openwaunlocked-session-sync` v5.6.2, `@eulab/openwaunlocked` v5.6.2

## 5.6.1
<sub>2026-10-14</sub>

- *(patch)* Version bump from group with `@eulab/openwaunlocked-core` v5.6.1

## 5.6.0
<sub>2026-10-14</sub>

- [#3540](https://github.com/open-wa/wa-automate-nodejs/pull/3540)  *(minor)*
  - ♻️ Replace runtime EventEmitter2 imports with the tuned Effect-backed HyperEmitter hybrid, removing the CommonJS named import behind [#3534](https://github.com/open-wa/wa-automate-nodejs/issues/3534). Ordinary callbacks remain synchronous; Promise and Effect listener work has scoped ownership.
  - 🏷️ Preserve the shared `ev` API: `*` and `**` wildcards, variadic arguments, listener context, `emitAsync()` results, QR and session-data alias payloads, and session metadata. Add `onScoped`, `onAnyScoped`, and `emitEffect` for Effect applications.
  - ✨ Expose optional native PubSub observations and scoped Stream/subscription helpers through HyperEmitter and shared `ev`, with lazy creation, explicit buffer policies, and emitter-owned shutdown.

## 5.5.1
<sub>2026-10-12</sub>

- *(patch)* Version bump from group with `@eulab/openwaunlocked-core` v5.5.1

## 5.5.0
<sub>2026-10-12</sub>

- *(minor)* Version bump from group with `@eulab/openwaunlocked-api` v5.5.0, `@eulab/openwaunlocked-cli` v5.5.0, `@eulab/openwaunlocked-client` v5.5.0, `@eulab/openwaunlocked-config` v5.5.0, `@eulab/openwaunlocked-core` v5.5.0, `@eulab/openwaunlocked-driver-interface` v5.5.0, `@eulab/openwaunlocked-driver-lightpanda` v5.5.0, `@eulab/openwaunlocked-driver-puppeteer` v5.5.0, `@eulab/openwaunlocked-mcp` v5.5.0, `@eulab/openwaunlocked-plugin-sdk` v5.5.0, `@eulab/openwaunlocked-schema` v5.5.0, `@eulab/openwaunlocked-socket-client` v5.5.0, `@eulab/openwaunlocked-stickers` v5.4.0, `@eulab/openwaunlocked` v5.5.0, `@eulab/openwaunlocked-types-only` v5.5.0

## 5.4.0
<sub>2026-09-30</sub>

- *(minor)* Version bump from group with `@eulab/openwaunlocked-client` v5.4.0, `@eulab/openwaunlocked-config` v5.4.0, `@eulab/openwaunlocked-core` v5.4.0, `@eulab/openwaunlocked` v5.4.0

## 5.3.0

- 🔖 Version alignment with OpenWA 5.3.0; no separate feature changes.

## 5.2.0
<sub>2026-09-29</sub>

- *(minor)* Version bump from group with `@eulab/openwaunlocked-client` v5.2.0, `@eulab/openwaunlocked-config` v5.2.0, `@eulab/openwaunlocked-core` v5.2.0, `@eulab/openwaunlocked-driver-interface` v5.2.0, `@eulab/openwaunlocked-driver-puppeteer` v5.2.0, `@eulab/openwaunlocked-schema` v5.2.0, `@eulab/openwaunlocked` v5.2.0

## 5.1.0
<sub>2026-09-29</sub>

- [#3453](https://github.com/open-wa/wa-automate-nodejs/pull/3453)  *(patch)* Thanks [@smashah](https://github.com/smashah)!
  Keep local Bun development on TypeScript source while publishing entry points that resolve the distributed files. npm packages no longer inherit workspace-only source conditions.
- *(minor)* Version bump from group with `@eulab/openwaunlocked-api` v5.1.0, `@eulab/openwaunlocked-client` v5.1.0, `@eulab/openwaunlocked-core` v5.1.0, `@eulab/openwaunlocked-schema` v5.1.0, `@eulab/openwaunlocked` v5.1.0

## 5.0.0

### Patch Changes

- Updated dependencies []:
  - @eulab/openwaunlocked-logger@1.0.0

## 5.0.0-alpha.7

### Patch Changes

- Updated dependencies []:
  - @eulab/openwaunlocked-logger@1.0.0

## 5.0.0-alpha.6

### Patch Changes

- Updated dependencies []:
  - @eulab/openwaunlocked-logger@1.0.0

## 5.0.0-alpha.5

### Patch Changes

- Updated dependencies []:
  - @eulab/openwaunlocked-logger@1.0.0

## 5.0.0-alpha.4

### Patch Changes

- Updated dependencies []:
  - @eulab/openwaunlocked-logger@1.0.0

## 5.0.0-alpha.3

### Patch Changes

- Updated dependencies []:
  - @eulab/openwaunlocked-logger@1.0.0

## 5.0.0-alpha.2

### Patch Changes

- Publish HyperEmitter with the v5 alpha package group.

- Updated dependencies []:
  - @eulab/openwaunlocked-logger@1.0.0

## 6.0.0-alpha.2

### Patch Changes

- Updated dependencies []:
  - @eulab/openwaunlocked-logger@1.0.0

## 5.0.1-alpha.2

### Patch Changes

- Dry run patch bump

- Updated dependencies []:
  - @eulab/openwaunlocked-logger@1.0.0
