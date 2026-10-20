import { afterEach, describe, expect, it, vi } from 'vitest';
import { HyperEmitter } from '@eulab/openwaunlocked-hyperemitter';
import { createLogger } from '@eulab/openwaunlocked-logger';
import type { IDriver } from '@eulab/openwaunlocked-driver-interface';
import { Transport } from '../../src/transport/Transport';
import type { OpenWAEventMap } from '../../src/events/eventMap';

function createTransport(patchConfig?: ConstructorParameters<typeof Transport>[0]['patchConfig']): Transport {
  return new Transport({
    driver: {} as IDriver,
    events: new HyperEmitter<OpenWAEventMap>({
      delimiter: '.',
      captureRejections: true,
      logger: createLogger({ component: 'core-test', sessionId: 'patch-semantics' }),
      debug: false,
      onError: () => undefined,
    }),
    logger: createLogger({ component: 'core-test', sessionId: 'patch-semantics' }),
    patchConfig,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('transport offline development lifecycle', () => {
  it('ignores keys and key resolvers without contacting the license service', async () => {
    const transport = createTransport();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network disabled'));
    const resolver = vi.fn().mockRejectedValue(new Error('Must not resolve a key'));
    const preloaded = await transport.preloadLicenseArtifact({ sessionId: 'dev', licenseKey: resolver, strict: true });
    const checked = await transport.checkLicenseArtifact(preloaded);
    expect(checked).toMatchObject({ status: 'valid', blockingFailure: false, artifact: null });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(resolver).not.toHaveBeenCalled();
  });

  it('does not evaluate supplied license payloads', async () => {
    const transport = createTransport();
    const evaluateScript = vi.fn();
    Object.assign(transport, { page: { evaluateScript } });
    vi.spyOn(transport.calling, 'install').mockResolvedValue();
    const checked = await transport.checkLicenseArtifact({ outcome: 'ready', status: 'valid',
      source: 'remote', artifact: { key: 'key', maskedKey: '****', source: 'remote',
        payload: 'malicious()', keyType: 'license', payloadSource: 'server' }, blockingFailure: false });
    expect(await transport.applyLicenseArtifact(checked)).toMatchObject({ status: 'valid', applied: true });
    expect(evaluateScript).not.toHaveBeenCalled();
  });
});
