# @eulab/openwaunlocked-driver-puppeteer














## 5.6.6
<sub>2026-10-16</sub>

- *(patch)* Version bump from group with `@eulab/openwaunlocked-hyperemitter` v5.6.6

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

- *(minor)* Version bump from group with `@eulab/openwaunlocked-api` v5.6.0, `@eulab/openwaunlocked-config` v5.6.0, `@eulab/openwaunlocked-core` v5.6.0, `@eulab/openwaunlocked-hyperemitter` v5.6.0, `@eulab/openwaunlocked-mcp` v5.6.0, `@eulab/openwaunlocked-schema` v5.6.0, `@eulab/openwaunlocked-socket-client` v5.6.0

## 5.5.1
<sub>2026-10-12</sub>

- *(patch)* Version bump from group with `@eulab/openwaunlocked-core` v5.5.1

## 5.5.0
<sub>2026-10-12</sub>

- [#3503](https://github.com/open-wa/wa-automate-nodejs/pull/3503)  *(minor)*
  - ✨ Add the public licensed-calling audio preview: bound Call controls, file and stream audio, recordings, remote media helpers and the Calls dashboard.
  - 🔒️ Calling uses the existing licensed patch delivery; expected availability failures log an actionable reason without stopping messaging.
  - ♻️ Own call media in scoped resources and finalize recordings on observed call end, media failure, disconnect and browser recovery.
- [#3521](https://github.com/open-wa/wa-automate-nodejs/pull/3521)  *(patch)*
  Remove browser downloads during CLI installation, prefer installed Chrome, and prompt for Chrome, Chromium or Lightpanda when a browser is missing. Explicit browser flags provision on demand and reuse persistent per-user caches on subsequent runs.

  Use stable Effect v4 for provisioning locks, temporary files, download retries and browser preference validation, and update the Effect package family together.

## 5.4.0
<sub>2026-09-30</sub>

- *(minor)* Version bump from group with `@eulab/openwaunlocked-client` v5.4.0, `@eulab/openwaunlocked-config` v5.4.0, `@eulab/openwaunlocked-core` v5.4.0, `@eulab/openwaunlocked` v5.4.0

## 5.3.0

- 🔖 Version alignment with OpenWA 5.3.0; no separate feature changes.

## 5.2.0
<sub>2026-09-29</sub>

- [#3465](https://github.com/open-wa/wa-automate-nodejs/pull/3465)  *(minor)* Thanks [@smashah](https://github.com/smashah)!
  Create a Bun and TypeScript messaging application with `bunx --bun @eulab/openwaunlocked init my-bot`. The public `create()` now prepares a matched browser, presents QR login, and returns a ready messaging client with private persistent session storage.

  Provision missing browsers at startup with shared cache coordination, configurable cache and download policy, and explicit-path errors. Preserve explicit drivers and low-level lifecycle control.

  Return a validated message ID from `sendText`, or throw `SendTextError` with a known-not-sent or uncertain outcome. Never retry an uncertain send automatically.

## 5.1.0
<sub>2026-09-29</sub>

- [#3453](https://github.com/open-wa/wa-automate-nodejs/pull/3453)  *(patch)* Thanks [@smashah](https://github.com/smashah)!
  Keep local Bun development on TypeScript source while publishing entry points that resolve the distributed files. npm packages no longer inherit workspace-only source conditions.
- *(minor)* Version bump from group with `@eulab/openwaunlocked-api` v5.1.0, `@eulab/openwaunlocked-client` v5.1.0, `@eulab/openwaunlocked-core` v5.1.0, `@eulab/openwaunlocked-schema` v5.1.0, `@eulab/openwaunlocked` v5.1.0

## 5.0.0

### Patch Changes

- Updated dependencies []:
  - @eulab/openwaunlocked-driver-interface@1.0.0

## 5.0.0-alpha.7

### Patch Changes

- Updated dependencies []:
  - @eulab/openwaunlocked-driver-interface@1.0.0

## 5.0.0-alpha.6

### Patch Changes

- Updated dependencies []:
  - @eulab/openwaunlocked-driver-interface@1.0.0

## 5.0.0-alpha.5

### Patch Changes

- Updated dependencies []:
  - @eulab/openwaunlocked-driver-interface@1.0.0

## 5.0.0-alpha.4

### Patch Changes

- Updated dependencies []:
  - @eulab/openwaunlocked-driver-interface@1.0.0

## 5.0.0-alpha.3

### Patch Changes

- Updated dependencies []:
  - @eulab/openwaunlocked-driver-interface@1.0.0

## 5.0.0-alpha.2

### Patch Changes

- Updated dependencies []:
  - @eulab/openwaunlocked-driver-interface@1.0.0

## 6.0.0-alpha.2

### Minor Changes

- Dry run minor bump

### Patch Changes

- Updated dependencies []:
  - @eulab/openwaunlocked-driver-interface@1.0.0

## 5.0.1-alpha.2

### Patch Changes

- Dry run patch bump

- Updated dependencies []:
  - @eulab/openwaunlocked-driver-interface@1.0.0
