# EULAB OpenWAUnlocked · npm

Autore e manutentore del fork: **EULAB**. Il pacchetto principale è
`@eulab/openwaunlocked`; i moduli pubblici usano `@eulab/openwaunlocked-*`.
La prima versione del fork è `1.0.0`. I termini applicabili sono nei file
LICENSE.md e NOTICE.md; le attribuzioni originali e di terze parti restano valide.

```sh
npm install @eulab/openwaunlocked
npx @eulab/openwaunlocked --help
```

Per pubblicare da terminale con la sessione di login npm:

```sh
npm login --auth-type=web --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm run release:npm:build
npm run release:npm:pack
node tools/release/smoke-eulab-npm.mjs
npm run release:npm:check -- --auth=login
# Dopo aver committato le modifiche e verificato i controlli:
npm run release:npm:publish -- --auth=login
```

Il login usa il browser per completare l'autenticazione e salva la sessione
nella configurazione utente npm. `--auth=login` usa quella configurazione senza
caricare `.env.npm.local`. Serve il permesso di pubblicazione sullo scope `@eulab`.
Bumpy esegue `npm publish`; se npm richiede un OTP, passarlo come
`npm_config_otp` nel terminale per la singola esecuzione, senza salvarlo nei file.
La compilazione e il confezionamento richiedono comunque pnpm installato.
Riferimento: [npm login](https://docs.npmjs.com/cli/v11/commands/npm-login/).

Per una pubblicazione locale con token, salvare `NPM_TOKEN=...` in `.env.npm.local`
nella radice e limitarne i permessi a `0600`. Il file è escluso da Git,
Docker e dai pacchetti. Non inserirlo nei sorgenti o nella chat.

Il token deve autorizzare **Packages and scopes → Read and write (publish and
stage)** sullo scope **@eulab**. Il permesso **Organizations → eulab** riguarda
solo la gestione dell'organizzazione e non sostituisce quello sui pacchetti.
Per pubblicare automaticamente con token serve Bypass 2FA, se consentito dalle
regole dell'organizzazione. Riferimento: [npm access tokens](https://docs.npmjs.com/about-access-tokens/).

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
La configurazione utente npm viene sostituita, solo per il processo di rilascio,
da un file temporaneo con il riferimento al token; il file utente originale
non viene modificato. Il primo errore interrompe la pubblicazione.
Verificare separatamente versione, dist-tag e tarball sul registry prima
di dichiarare la release disponibile; una versione accettata non va ripubblicata.

`dev/release/Dockerfile` compila tutti i moduli, esegue i controlli mirati
e installa i tarball in un progetto pulito, senza avviare WhatsApp.
Questi controlli non sostituiscono le prove fisiche delle API documentate
in [DEMO-COLLAUDO.md](DEMO-COLLAUDO.md).
