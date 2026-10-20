/**
 * @eulab/openwaunlocked-types-only
 *
 * Lightweight type-only re-exports from @eulab/openwaunlocked-schema.
 * This package ships ZERO runtime code — only .d.ts declarations.
 * Use it when you need open-wa types without pulling in zod, codecs, or other runtime deps.
 */
export type {
  // === Identity types ===
  ChatId,
  MessageId,
  ContactId,
  GroupChatId,
  GroupId,

  // === Core model types ===
  Chat,
  Message,
  Contact,
  Content,
  GroupMetadata,
  Id,
  DataURL,
  Base64,

  // === Message types ===
  MessageAck,
  MessageTypes,

  // === Config types ===
  Config,
  StrictConfig,
  PartialConfig,
  DeepPartialConfig,
  ClientConfig,
  SessionData,
  DevTools,
  Viewport,
  QueueOptions,

  // === Method types ===
  ClientFunctionMetadata,
  MethodDefinition,
  ParameterMetadata,
  CapabilityDefinition,
  CapabilityMetadata,
  CapabilityStatus,
  CapabilityType,

  // === Event types ===
  EventDefinition,
  EventMetadata,
  EventStatus,

  // === Schema inference helpers ===
  InferInput,
  InferOutput,
} from '@eulab/openwaunlocked-schema';

export type { BaseClient, BaseNamespacedClient } from '@eulab/openwaunlocked-schema/generated';

// === Value re-exports (enums, constants needed at type-level) ===
export {
  SimpleListener,
  HttpMethod,
  HttpMethodEnum,
  LicenseTier,
  LicenseEnum,
  FunctionalityScope,
  FunctionalityEnum,
  ActionType,
  ActionEnum,
  StateEnum,
  NotificationLanguage,
  QRFormat,
} from '@eulab/openwaunlocked-schema';

export type { Call, CallAudioObserver, CallSnapshot, CallActionResult, CallCapabilities, CallIdentity, CallMediaOptions, CallingOptions, AudioInput, AudioOutput, VideoInput, MediaDescriptor, RawAudioFormat } from '@eulab/openwaunlocked-schema';
export { DEFAULT_MIC, DEFAULT_SPEAKER, DEFAULT_CAM, normalizeCallMedia } from '@eulab/openwaunlocked-schema/calling-media';
