ARG BUILD_IMAGE=node:22.22.3-bookworm
FROM ${BUILD_IMAGE} AS release
USER root
ENV PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true TURBO_TELEMETRY_DISABLED=1 CI=true
WORKDIR /workspace
RUN command -v pnpm >/dev/null || npm install --global pnpm@11.25.0
COPY . .
RUN --mount=type=cache,id=openwa-dev-pnpm,target=/root/.local/share/pnpm/store pnpm install --lockfile-only --ignore-scripts && pnpm install --frozen-lockfile --ignore-scripts
RUN node tools/release/prepare-eulab-npm.mjs build
RUN node --test dev/patches/test.mjs tools/regression/offline-development.test.mjs dev/test/conversation.test.mjs dev/test/calling-stream.test.mjs && pnpm --filter @eulab/openwaunlocked-client exec vitest run src/__tests__/runtime-surface-audit.test.ts src/__tests__/runtime-surface-smoke.test.ts && pnpm --filter @eulab/openwaunlocked-core exec vitest run test/unit/patchLifecycleSemantics.test.ts && pnpm --filter @eulab/openwaunlocked-runtime-node exec vitest run src/calling/VoiceCallAudio.test.ts && pnpm --filter @eulab/openwaunlocked-config exec vitest run src/__tests__/schema.test.ts
RUN node tools/release/prepare-eulab-npm.mjs pack
RUN node tools/release/smoke-eulab-npm.mjs
