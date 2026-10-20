/**
 * Client configuration types - re-exported from @eulab/openwaunlocked-config
 * 
 * @deprecated Import from '@eulab/openwaunlocked-config' instead
 */

export { ConfigSchema as ClientConfigSchema, type Config as ClientConfig } from '@eulab/openwaunlocked-config';

/**
 * Migrates a v4 configuration object to the v5 schema format.
 * Currently, most v4 options are compatible with v5.
 * This function serves as a placeholder for any future transformations.
 * 
 * @deprecated This is a legacy compatibility function. Use @eulab/openwaunlocked-config directly.
 */
export function migrateV4Config(oldConfig: Record<string, unknown>): Record<string, unknown> {
    // Deep clone to avoid mutating original
    const config = JSON.parse(JSON.stringify(oldConfig));

    // Example migration: if 'authTimeout' was string in some legacy version (unlikely but example)
    if (typeof config.authTimeout === 'string') {
        config.authTimeout = parseInt(config.authTimeout, 10);
    }

    if (config.apiLifecycle === undefined) {
        config.apiLifecycle = 'hybrid';
    }

    return config;
}
