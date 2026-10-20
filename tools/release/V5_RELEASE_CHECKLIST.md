# Upstream v5.0.0 historical release record

This record concerns the original upstream release. It does not describe the EULAB 1.0.0 publication; see [NPM-RELEASE.md](../../docs/development/NPM-RELEASE.md).

v5.0.0 was published on 2026-09-28. The [release workflow](https://github.com/open-wa/wa-automate-nodejs/actions/runs/36475948032) completed, and the [GitHub release](https://github.com/open-wa/wa-automate-nodejs/releases/tag/v5.0.0) is stable. The upstream release changed its default install from v4.76.0 to v5.0.0.

All 32 public packages were versioned 5.0.0. Five new runtime packages needed an initial maintainer publish before npm would accept Trusted Publisher settings. The `release.yml` job in the `Release` environment now has per-package OIDC publish access. Bumpy 1.18.1 replaces Changesets for future versions and publishes through npm's OIDC-capable CLI.

## Dependency audit at release

The refresh included the major migrations in [Vitest 5](https://vitest.dev/guide/migration/), [EventSource 5](https://github.com/EventSource/eventsource/blob/main/MIGRATION.md), [Cosmiconfig 10](https://github.com/cosmiconfig/cosmiconfig/blob/main/CHANGELOG.md), [Chalk 6](https://github.com/chalk/chalk/releases), [ts-morph 28](https://github.com/dsherret/ts-morph/releases), and [deepmerge-ts 8](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0). Cosmiconfig 10 requires separate synchronous loaders and excludes ESM config files from synchronous search.

The earlier production audit found no critical advisories. Its remaining high advisories were transitive in docs, Lightpanda Puppeteer, and the S3/session-sync `pico-s3` path. The patched `image-size` major is incompatible with `datauri`'s exact 1.0.0 dependency, so that override needs an integration migration rather than an unreviewed lockfile pin.

## Registry checks

Use `npm view @eulab/openwaunlocked dist-tags --json --prefer-online` for the main entry point and inspect each package's `latest` tag before declaring the package set complete. npm's read API can lag a successful publish for several minutes; a duplicate-publish rejection proves the version was accepted but does not prove the public metadata has caught up.
