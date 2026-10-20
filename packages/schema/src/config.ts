/**
 * Configuration schema and types - re-exported from @eulab/openwaunlocked-config
 * 
 * This file provides backward compatibility for code that imports from @eulab/openwaunlocked-schema.
 * New code should import directly from @eulab/openwaunlocked-config.
 * 
 * @deprecated Import from '@eulab/openwaunlocked-config' instead
 */

// Re-export everything from @eulab/openwaunlocked-config
export {
  // Enums
  QRFormat,
  CLOUD_PROVIDERS,
  DIRECTORY_STRATEGY,
  NotificationLanguage,
  OnError,
  LicenseType,
  // Sub-schemas
  SessionDataSchema,
  DevToolsSchema,
  ProxyServerCredentialsSchema,
  CloudUploadOptionsSchema,
  ViewportSchema,
  S3SyncSchema,
  LoggingTransportSchema,
  // Main schema
  ConfigSchema,
  PartialConfigSchema,
  StrictConfigSchema,
  // Types
  type Config,
  type PartialConfig,
  type DeepPartialConfig,
  type StrictConfig,
  type SessionData,
  type DevTools,
  type ProxyServerCredentials,
  type CloudUploadOptions,
  type Viewport,
  type S3Sync,
  type LoggingTransport,
  // Validation helpers
  validateConfig,
  parseConfig,
  getDefaultConfig,
} from '@eulab/openwaunlocked-config';
