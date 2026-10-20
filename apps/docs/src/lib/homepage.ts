import { CURRENT_VERSION, DOCS_PATHS, REPO_URL, SITE_ORIGIN } from './site';

export const HOMEPAGE_TITLE = 'EULAB Open | Self-hosted WhatsApp API for Node.js';
export const HOMEPAGE_DESCRIPTION = 'EULAB Open is a self-hosted WhatsApp API and Node.js library for developers. Send messages, receive events, and connect WhatsApp to your app on your own server.';

export const HOMEPAGE_FAQS = [
  {
    question: 'What is EULAB Open?',
    answer: HOMEPAGE_DESCRIPTION,
    href: DOCS_PATHS.runtimeModel,
    label: 'How EULAB Open works',
  },
  {
    question: 'Who is EULAB Open best for?',
    answer: 'Developers who want to connect an existing WhatsApp account to their own applications, support tools, or automation workflows through HTTP or Node.js.',
    href: DOCS_PATHS.integrationsOverview,
    label: 'Explore integrations',
  },
  {
    question: 'How do I send WhatsApp messages from Node.js?',
    answer: 'Install @eulab/openwaunlocked, create a connected client, link your WhatsApp account, and call client.sendText with the recipient and message. The Node.js guide walks through each step.',
    href: DOCS_PATHS.customCode,
    label: 'Send a message with Node.js',
  },
  {
    question: 'Can I use EULAB Open from Python, PHP, or another language?',
    answer: 'Yes. Start the Easy API on a machine with Node.js, link WhatsApp, and call its HTTP endpoints from your application. Your application can use any language that makes HTTP requests.',
    href: DOCS_PATHS.quickstart,
    label: 'Start the WhatsApp HTTP API',
  },
  {
    question: 'Does EULAB Open require an activation key?',
    answer: 'EULAB Open provides API access without paid tiers or activation keys in this development branch. Runtime availability and physical acceptance remain separate from access. The original source license remains in effect.',
    href: '/docs/licensing/pricing',
    label: 'Open access and availability',
  },
  {
    question: 'Is EULAB Open the official WhatsApp Business API?',
    answer: 'No. EULAB Open is an unofficial fork with no affiliation to WhatsApp or Meta. It connects through WhatsApp Web, and using automation can lead to account restrictions or bans.',
    href: DOCS_PATHS.bestPractices,
    label: 'Read the operating guidance',
  },
] as const;

export const HOMEPAGE_SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_ORIGIN}/#organization`,
      name: 'EULAB Open',
      alternateName: 'EULAB',
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/logo.png`,
      sameAs: [],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      name: 'EULAB Open',
      alternateName: 'EULAB',
      url: SITE_ORIGIN,
      description: HOMEPAGE_DESCRIPTION,
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
      inLanguage: 'en',
    },
    {
      '@type': ['SoftwareApplication', 'SoftwareSourceCode'],
      '@id': `${SITE_ORIGIN}/#software`,
      name: 'EULAB Open',
      alternateName: ['OpenWA', '@eulab/openwaunlocked'],
      url: SITE_ORIGIN,
      description: HOMEPAGE_DESCRIPTION,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Linux, macOS, Windows',
      runtimePlatform: 'Node.js >=22.21.1',
      programmingLanguage: ['JavaScript', 'TypeScript'],
      softwareVersion: CURRENT_VERSION,
      codeRepository: REPO_URL,
      license: `${REPO_URL}/blob/master/LICENSE.md`,
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_ORIGIN}/#faq`,
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
      mainEntity: HOMEPAGE_FAQS.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    },
  ],
};
