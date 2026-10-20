import { describe, expect, it, vi } from 'vitest';
import { ConfigSchema } from '@eulab/openwaunlocked-config';

vi.mock('@eulab/openwaunlocked-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));
vi.mock('@eulab/openwaunlocked-session-sync', () => ({
  LocalSessionCompression: class MockLocalSessionCompression {},
  S3SyncManager: class MockS3SyncManager {},
}));

describe('wa-automate public contract', () => {
  it('re-exports config truth from @eulab/openwaunlocked-config and runtime bootstrap from @eulab/openwaunlocked-core', async () => {
    const createClientMock = vi.fn();

    vi.doMock('@eulab/openwaunlocked-core', () => ({ createClient: createClientMock }));
    vi.doMock('@eulab/openwaunlocked-client', () => ({}));
    vi.doMock('@eulab/openwaunlocked-schema', () => ({ eventRegistry: { getAll: () => [] } }));
    vi.doMock('@eulab/openwaunlocked-driver-puppeteer', () => ({ PuppeteerDriver: class MockPuppeteerDriver {} }));
    vi.doMock('@eulab/openwaunlocked-driver-lightpanda', () => ({ LightpandaDriver: class MockLightpandaDriver {} }));

    const waAutomate = await import('../../index');
    const { createClient } = await import('@eulab/openwaunlocked-core');

    expect(waAutomate.ConfigSchema).toBe(ConfigSchema);
    expect(waAutomate.createClient).toBe(createClient);
  });

  it('keeps the top-level package focused on CLI and API runtime ownership plus passthrough compatibility exports', async () => {
    vi.resetModules();
    vi.doMock('@eulab/openwaunlocked-core', () => ({ createClient: vi.fn() }));
    vi.doMock('@eulab/openwaunlocked-client', () => ({}));
    vi.doMock('@eulab/openwaunlocked-schema', () => ({ eventRegistry: { getAll: () => [] } }));
    vi.doMock('@eulab/openwaunlocked-driver-puppeteer', () => ({ PuppeteerDriver: class MockPuppeteerDriver {} }));
    vi.doMock('@eulab/openwaunlocked-driver-lightpanda', () => ({ LightpandaDriver: class MockLightpandaDriver {} }));

    const waAutomate = await import('../../index');

    expect(typeof waAutomate.WAServer).toBe('function');
    expect(typeof waAutomate.APILifecycleManager).toBe('function');
    expect(typeof waAutomate.SessionArchiveManager).toBe('function');
    expect(typeof waAutomate.runCli).toBe('function');
    expect(typeof waAutomate.startCli).toBe('function');
    expect(typeof waAutomate.parseCliArgs).toBe('function');
  });
});
