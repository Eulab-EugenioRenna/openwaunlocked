export { Client } from './Client';
export { hydrateCall } from './calls';
export type { CallActions } from './calls';
export { DEFAULT_MIC, DEFAULT_SPEAKER, DEFAULT_CAM } from '@eulab/openwaunlocked-schema';
export type { Call, CallSnapshot, CallEndReason, CallActionResult, CallCapabilities, CallAudioObserver, CallMediaOptions, CallingOptions, AudioInput, AudioOutput, VideoInput, MediaDescriptor, RawAudioFormat } from '@eulab/openwaunlocked-schema';
export type { ClientConfig, EvaluateFn } from './Client';
export type { LicenseFeatures } from '@eulab/openwaunlocked-schema';
export { SendTextError } from './SendTextError';
export type { SendTextErrorCode, SendTextOutcome } from './SendTextError';
export { SendStickerError } from './SendStickerError';
export type { StickerInput, StickerJob, StickerEffect, StickerResult } from '@eulab/openwaunlocked-stickers';

export type { MessagingMethods } from './methods/messaging';
export type { MediaMethods } from './methods/media';
export type { StatusMethods } from './methods/status';
export type { MediaInput, MediaSendResult } from './mediaInput';
export type { GroupMethods } from './methods/groups';
export type { ChatMethods } from './methods/chats';
export type { ContactMethods } from './methods/contacts';

export {
  MessageCollector,
  awaitMessages,
  Collector,
  Collection,
} from '@eulab/openwaunlocked-domain';

export type {
  MessageCollectorOptions,
  MessageCollectorEvents,
  AwaitMessagesOptions,
  CollectorFilter,
  CollectorOptions,
} from '@eulab/openwaunlocked-domain';

export type {
  ChatId,
  ContactId,
  GroupId,
  MessageId,
  Message,
  Chat,
  Contact,
  GroupMetadata,
  GroupInfo,
  ParticipantChange,
  DataURL,
  Base64,
  Content,
  AlbumMedia,
  AlbumSendResult,
} from '@eulab/openwaunlocked-schema';

export type { InteractiveMethods } from './methods/interactive';
export type { WhatsAppEventMethods } from './methods/whatsapp-events';
export { EventInputSchema, EventUpdateSchema, WhatsAppEventSchema, EventResponseSchema, EventResponseTypeSchema, EventListOptionsSchema, EventPageSchema, serializeWhatsAppEvent, deserializeWhatsAppEvent, serializeEventResponse, deserializeEventResponse } from '@eulab/openwaunlocked-schema';
export type { EventInput, EventUpdate, WhatsAppEvent, EventResponse, EventResponseType, EventPage, EventListOptions } from '@eulab/openwaunlocked-schema';
export { defineInteractiveMessage, InteractiveContentSchema, InteractiveResponseSchema, FormResponseSchema } from '@eulab/openwaunlocked-schema';
export type { InteractiveContent, InteractiveAction, InteractiveHeader, FormQuestion, InteractiveResponse, FormResponse, JsonValue } from '@eulab/openwaunlocked-schema';

export { MediaSendOptionsSchema, PollSendOptionsSchema, PollVoteSchema, PollResultsSchema } from '@eulab/openwaunlocked-schema';
export type { MediaSendOptions, ImageSendOptions, VideoSendOptions, AudioSendOptions, AudioAttachmentOptions, VoiceNoteOptions, GifSendOptions, PollSendOptions, PollVote, PollResults, PinDuration } from '@eulab/openwaunlocked-schema';
