import { version } from '../../../../packages/wa-automate/package.json';

export type AccessTier = 'open';

export const SITE_NAME = 'Eulab Open · documentazione';
// Canonical origin for the docs site. Used for sitemap, robots, OG image URLs,
// and og:url so they never disagree. Current docs are served at openwa.dev;
// docs.openwa.dev redirects to the current documentation.
export const SITE_ORIGIN = 'https://openwa.dev';
export const REPO_URL = 'https://github.com/open-wa/wa-automate-nodejs';
export const CURRENT_VERSION = version;

export const DOCS_PATHS = {
  blog: '/blog',
  changelog: '/changelog',
  overview: '/docs',
  apiExplorer: '/api-explorer',
  quickstart: '/docs/getting-started/quickstart',
  easyApi: '/docs/getting-started/easy-api',
  customCode: '/docs/getting-started/custom-code',
  linkCode: '/docs/getting-started/link-code',
  configuration: '/docs/guides/configuration-and-cli',
  sessionEvents: '/docs/guides/session-events',
  multiSession: '/docs/guides/multiple-sessions',
  messages: '/docs/guides/messages',
  sendMessage: '/docs/guides/send-message-api',
  whatsappBot: '/docs/guides/whatsapp-bot',
  whatsappBotPython: '/docs/guides/whatsapp-bot-python',
  webhooks: '/docs/client-and-integrations/webhook-payloads',
  media: '/docs/guides/media',
  groups: '/docs/guides/groups',
  socketClient: '/docs/client-and-integrations/socket-client',
  chatwoot: '/docs/client-and-integrations/chatwoot',
  cloudflareProxy: '/docs/client-and-integrations/cf-proxy',
  proxying: '/docs/client-and-integrations/proxying-a-session',
  runtimeModel: '/docs/concepts/how-it-works',
  glossary: '/docs/concepts/glossary',
  bestPractices: '/docs/operations-and-troubleshooting/best-practices',
  errorHandling: '/docs/operations-and-troubleshooting/error-handling',
  logoutDetection: '/docs/operations-and-troubleshooting/detect-logouts',
  licensedFeatures: '/docs/licensing/licensed-features',
  integrationsOverview: '/docs/guides/integrations-overview',
  referenceClient: '/docs/reference/client/client',
} as const;
