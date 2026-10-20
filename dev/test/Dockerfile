ARG BUILD_IMAGE=node:22.22.3-bookworm
ARG RUNTIME_IMAGE=node:22.22.3-bookworm-slim
FROM ${BUILD_IMAGE} AS build
USER root
ENV PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true TURBO_TELEMETRY_DISABLED=1 CI=true
RUN npm install --global pnpm@11.25.0 --force
WORKDIR /workspace
COPY . .
RUN --mount=type=cache,id=openwa-dev-pnpm,target=/root/.local/share/pnpm/store pnpm --filter @eulab/openwaunlocked-monorepo --filter openwa-free-dev-test-harness... install --frozen-lockfile --ignore-scripts --prod=false
RUN pnpm exec turbo build --filter=@eulab/openwaunlocked-client... --filter=@eulab/openwaunlocked-driver-puppeteer... --filter=@eulab/openwaunlocked-runtime-node...
RUN node --test dev/patches/test.mjs tools/regression/offline-development.test.mjs dev/test/conversation.test.mjs dev/test/calling-stream.test.mjs && pnpm --filter @eulab/openwaunlocked-client exec vitest run src/__tests__/runtime-surface-audit.test.ts src/__tests__/runtime-surface-smoke.test.ts && pnpm --filter @eulab/openwaunlocked-core exec vitest run test/unit/patchLifecycleSemantics.test.ts && pnpm --filter @eulab/openwaunlocked-runtime-node exec vitest run src/calling/VoiceCallAudio.test.ts
RUN --mount=type=cache,id=openwa-dev-pnpm,target=/root/.local/share/pnpm/store npx --yes --package=pnpm@12.14.0 pnpm --pm-on-fail=ignore --filter openwa-free-dev-test-harness deploy --prod --ignore-scripts /out

FROM ${RUNTIME_IMAGE} AS runtime
USER root
RUN apt-get update && apt-get install -y --no-install-recommends chromium ffmpeg ca-certificates fonts-liberation && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/openwa-free-dev-test
COPY --from=build /out /opt/openwa-free-dev-test
COPY patches.json /opt/openwa-free-dev-test/patches.json
COPY dev/patches/src /opt/openwa-free-dev-test/patches
RUN node -e "const fs=require('fs'); const path=require('path'); const {createRequire}=require('module'); const fromRuntime=createRequire(require.resolve('@eulab/openwaunlocked-runtime-node')); const entry=fromRuntime.resolve('ffmpeg-static'); fs.symlinkSync('/usr/bin/ffmpeg',path.join(path.dirname(entry),'ffmpeg'));" && mkdir -p /state && chown node:node /state
USER node
ENV NODE_ENV=development DEV_PORT=8099 DEV_STATE_PATH=/state DEV_PATCH_SOURCE_PATH=/opt/openwa-free-dev-test/patches CHROMIUM_PATH=/usr/bin/chromium
EXPOSE 8099
ENTRYPOINT ["node", "server.mjs"]
