# EULAB OpenWAUnlocked · npm

Autore e manutentore del fork: **EULAB**. Il pacchetto principale è
`@eulab/openwaunlocked`; i moduli pubblici usano `@eulab/openwaunlocked-*`.
La prima versione del fork è `1.0.0`. I termini applicabili sono nei file
LICENSE.md e NOTICE.md; le attribuzioni originali e di terze parti restano valide.

```sh
npm install @eulab/openwaunlocked
npx @eulab/openwaunlocked --help
```

Per una pubblicazione locale, salvare `NPM_TOKEN=...` in `.env.npm.local`
nella radice e limitarne i permessi a `0600`. Il file è escluso da Git,
Docker e dai pacchetti. Non inserirlo nei sorgenti o nella chat.

```sh
pnpm release:npm:build
pnpm release:npm:pack
node tools/release/smoke-eulab-npm.mjs
pnpm release:npm:check
pnpm release:npm:publish
```

La pubblicazione usa Bumpy, accesso pubblico e tag `latest`. L'esecuzione
locale con token passa alla pipeline pubblica di Bumpy una configurazione in
memoria con provenance OIDC disattivata, senza modificare `_config.json`.
Il controllo Git avviene prima di preparare l'autenticazione temporanea in
`.npmrc`, che viene ripristinato al termine. I tag Git non vengono inviati automaticamente.
Verificare separatamente versione, dist-tag e tarball sul registry prima
di dichiarare la release disponibile; una versione accettata non va ripubblicata.

`dev/release/Dockerfile` compila tutti i moduli, esegue i controlli mirati
e installa i tarball in un progetto pulito, senza avviare WhatsApp.
Questi controlli non sostituiscono le prove fisiche delle API documentate
in [DEMO-COLLAUDO.md](DEMO-COLLAUDO.md).
