import { Context, Effect, Layer } from 'effect';
import type {
  RuntimeCapability,
  RuntimeCapabilityError,
  RuntimeKind,
  SessionAdmissionError,
} from './errors';

export interface RuntimeCapabilitiesShape {
  readonly runtime: RuntimeKind;
  readonly supported: ReadonlySet<RuntimeCapability>;
  readonly has: (capability: RuntimeCapability) => boolean;
  readonly require: (
    capability: RuntimeCapability,
  ) => Effect.Effect<void, RuntimeCapabilityError>;
}

export const RuntimeCapabilities =
  Context.Service<RuntimeCapabilitiesShape>('@eulab/openwaunlocked-RuntimeCapabilities');

export interface BrowserDriverShape {
  readonly launch: (options?: unknown) => Effect.Effect<unknown, unknown>;
}

export const BrowserDriver =
  Context.Service<BrowserDriverShape>('@eulab/openwaunlocked-BrowserDriver');

export interface BrowserSessionShape {
  readonly page: unknown;
  readonly close: Effect.Effect<void>;
}

export const BrowserSession =
  Context.Service<BrowserSessionShape>('@eulab/openwaunlocked-BrowserSession');

export interface PatchSourceShape<Artifact = unknown> {
  readonly preload: Effect.Effect<Artifact, unknown>;
}

export const PatchSource =
  Context.Service<PatchSourceShape>('@eulab/openwaunlocked-PatchSource');

export interface LicenseServiceShape<Artifact = unknown, Identity = unknown> {
  readonly preflight: Effect.Effect<Artifact | null, unknown>;
  readonly validate: (
    identity: Identity,
    artifact: Artifact | null,
  ) => Effect.Effect<Artifact | null, unknown>;
}

export const LicenseService =
  Context.Service<LicenseServiceShape>('@eulab/openwaunlocked-LicenseService');

export interface SessionStoreShape {
  readonly get: (key: string) => Effect.Effect<unknown, unknown>;
  readonly set: (key: string, value: unknown) => Effect.Effect<void, unknown>;
  readonly remove: (key: string) => Effect.Effect<void, unknown>;
}

export const SessionStore =
  Context.Service<SessionStoreShape>('@eulab/openwaunlocked-SessionStore');

export interface PluginRegistryShape {
  readonly names: Effect.Effect<ReadonlyArray<string>>;
  readonly close: Effect.Effect<void>;
}

export const PluginRegistry =
  Context.Service<PluginRegistryShape>('@eulab/openwaunlocked-PluginRegistry');

export interface ChatExecutorShape {
  readonly execute: (
    chatId: string,
    source: string,
    input?: unknown,
  ) => Effect.Effect<unknown, unknown>;
  readonly closeChat: (chatId: string) => Effect.Effect<void>;
}

export const ChatExecutor =
  Context.Service<ChatExecutorShape>('@eulab/openwaunlocked-ChatExecutor');

export interface SessionAdmissionLease {
  readonly memoryMb: number;
  readonly release: Effect.Effect<void>;
}

export interface SessionAdmissionShape {
  readonly acquire: (
    memoryMb: number,
  ) => Effect.Effect<SessionAdmissionLease, SessionAdmissionError>;
  readonly snapshot: Effect.Effect<{
    readonly capacityMemoryMb: number;
    readonly availableMemoryMb: number;
    readonly activeSessions: number;
  }>;
}

export const SessionAdmission =
  Context.Service<SessionAdmissionShape>('@eulab/openwaunlocked-SessionAdmission');

export interface RuntimeObservabilityShape {
  readonly increment: (
    metric: RuntimeMetric,
    value?: number,
    attributes?: Readonly<Record<string, string | number | boolean>>,
  ) => Effect.Effect<void>;
  readonly gauge: (
    metric: RuntimeMetric,
    value: number,
    attributes?: Readonly<Record<string, string | number | boolean>>,
  ) => Effect.Effect<void>;
  readonly snapshot: Effect.Effect<Readonly<Record<string, number>>>;
  readonly recordCause: (
    scope: string,
    cause: unknown,
    attributes?: Readonly<Record<string, string | number | boolean>>,
  ) => Effect.Effect<void>;
  readonly causes: Effect.Effect<ReadonlyArray<RuntimeCauseRecord>>;
}

export interface SerializedRuntimeCause {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly cause?: SerializedRuntimeCause;
  readonly errors?: ReadonlyArray<SerializedRuntimeCause>;
}

export interface RuntimeCauseRecord {
  readonly scope: string;
  readonly recordedAt: number;
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
  readonly cause: SerializedRuntimeCause;
}

export type RuntimeMetric =
  | 'active_fibers'
  | 'cause_failures'
  | 'queue_active'
  | 'queue_depth'
  | 'queue_drops'
  | 'queue_failures'
  | 'rate_decisions'
  | 'retry_decisions'
  | 'session_browser_memory_mb'
  | 'startup_phase_ms'
  | 'startup_critical_path_ms';

export const RuntimeObservability =
  Context.Service<RuntimeObservabilityShape>('@eulab/openwaunlocked-RuntimeObservability');

export const serviceLayer = <I, S>(key: Context.Key<I, S>, service: S) =>
  Layer.succeed(key, service);
