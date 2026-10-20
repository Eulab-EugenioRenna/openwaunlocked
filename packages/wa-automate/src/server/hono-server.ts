import { ApiServer, createApiServer as createSharedApiServer } from '@eulab/openwaunlocked-api';
import type { Config } from '@eulab/openwaunlocked-config';

export class WAServer extends ApiServer {
  constructor(config: Config, verbose = false) {
    super({ config, verbose });
  }
}

export function createApiServer(config: Config) {
  return createSharedApiServer(config);
}
