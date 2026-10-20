import type { Logger } from '@eulab/openwaunlocked-logger';
import { Context, Effect, Layer } from 'effect';
import { ChatwootClient } from './client';
import type { ChatwootConfig } from './config';

export const ChatwootClientService =
  Context.Service<ChatwootClient>('@eulab/openwaunlocked-integration-chatwoot/ChatwootClient');

export const chatwootClientTestLayer = (client: ChatwootClient) =>
  Layer.succeed(ChatwootClientService, client);

export const chatwootClientLayer = (
  config: ChatwootConfig,
  logger: Pick<Logger, 'debug' | 'info' | 'error'>,
) => Layer.effect(
  ChatwootClientService,
  Effect.acquireRelease(
    Effect.sync(() => new ChatwootClient(config, logger)),
    (client) => Effect.sync(() => client.close()),
  ),
);
