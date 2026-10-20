import { useEffect, useState } from 'react';
import { getClient } from '@/lib/api-client';
import { useDemo } from '@/lib/demo/use-demo';
import { useSocket } from './use-socket';
import { useSessionRefresh } from './use-session-refresh';

type RuntimeFeatures = {
  state: 'loading' | 'ready' | 'unavailable';
  features: Readonly<Record<string, boolean>>;
  source: 'runtime' | 'demo' | null;
};
const initial: RuntimeFeatures = { state: 'loading', features: {}, source: null };
const demo: RuntimeFeatures = { state: 'ready', features: { patch_calls_control: false, patch_calls_audio: false, patch_calls_video: false }, source: 'demo' };

export function useRuntimeFeatures(): RuntimeFeatures {
  const { isDemo } = useDemo();
  const { connected } = useSocket();
  const refreshOperation = useSessionRefresh();
  const [snapshot, setSnapshot] = useState<RuntimeFeatures>(isDemo ? demo : initial);
  useEffect(() => {
    if (isDemo) { setSnapshot(demo); return; }
    if (!connected) { setSnapshot({ ...initial, state: 'unavailable' }); return; }
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const client = await getClient();
        // Local runtime metadata only. This branch performs no key validation.
        const result = await client.getLicenseFeatures();
        if (mounted) setSnapshot({ state: 'ready', features: result.features, source: 'runtime' });
      } catch {
        if (mounted) setSnapshot({ ...initial, state: 'unavailable', source: 'runtime' });
      }
      if (mounted) timer = setTimeout(read, 30_000);
    };
    void read();
    return () => { mounted = false; clearTimeout(timer); };
  }, [isDemo, connected, refreshOperation.snapshot?.finishedAt]);
  return refreshOperation.snapshot?.running ? initial : snapshot;
}
