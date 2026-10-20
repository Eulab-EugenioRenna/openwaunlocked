> Stato aggiornato: [audit completo delle 29 API](./PREMIUM-AUDIT.md).
> Conversazione audio bidirezionale confermata dall'utente il 20 ottobre 2026.
> [API per IVR e agente vocale esterno](./VOICE-API.md): implementazione Node,
> senza installazione del modello e senza certificazione delle API ancora da provare.

# EULAB Open · sviluppo

Stato aggiornato al 20 ottobre 2026. Branch: `dev/free-use-offline`.
Autore e manutentore: **EULAB**. Questa documentazione descrive il fork locale di sviluppo, non i pacchetti npm
pubblicati. Non trasferire automaticamente queste modifiche su `master` o
`release`. I file di licenza e le attribuzioni del progetto restano presenti:
“free dev” indica l'assenza di controlli della chiave nel runtime di questo branch.

## Identità EULAB e accesso Open

I 57 manifest del checkout indicano EULAB come autore del fork. README, sito
documentazione e dashboard presentano l'accesso alle API come **Open**. Sono
rimossi il checkout commerciale, i moduli per inserire chiavi e i collegamenti
di acquisto. Le capacità mostrate nel pannello Open provengono dal runtime;
non sono forzate a disponibili. I riferimenti dei 154 metodi sono rigenerati
dal registro corrente.

Le condizioni e le attribuzioni del codice originale sono conservate nei file
di licenza, nelle note storiche e in [NOTICE.md](../../NOTICE.md). Open indica
l'accesso alle funzionalità, non una sostituzione della licenza del codice.
I nomi tecnici dei pacchetti e degli import restano quelli effettivi.

Verifica del 20 ottobre 2026: build dashboard e dipendenze superata (16 task),
pannello Open controllato in Chromium desktop/mobile in modalità demo, senza
collegamenti WhatsApp. Il controllo tipi del sito docs resta in errore anche
con i sorgenti originali: nessuna nuova sede/codice di errore dopo la modifica.
Il controllo editoriale generale resta aperto. La build docs compila client e
server, ma il prerender completo fallisce sulla pagina dei tipi
`return-types#llmmessage`; non è dichiarato superato. Nessuna pubblicazione o
sostituzione del container della sessione WhatsApp è stata eseguita.

## Comportamento del runtime

- Nessuna risoluzione di chiavi, validazione remota, scadenza, rinnovo o esecuzione
  di payload restituiti dal servizio di licenza.
- I domini `openwa.dev`, `openwa.cloud` e relativi sottodomini sono bloccati
  dall'intercettazione browser. Un driver senza intercettazione impedisce l'avvio.
- Le patch comuni sono lette dal `patches.json` della directory di esecuzione,
  oppure da `patches.cache.json` se il primo file manca. Nessun download remoto.
- Le definizioni di metodi ed eventi nello schema usano `license: 'none'`.
- `getLicenseFeatures()` descrive il contesto development senza scadenza;
  le capacità chiamate dipendono dal provider effettivamente installato.

Offline riguarda validazione e caricamento delle patch. WhatsApp continua a
richiedere Internet; eventuali URL di media forniti dall'applicazione possono
richiedere accesso alla rete. Non è un runtime WhatsApp interamente offline.

## Sorgenti e pipeline

`packages/core/src/transport/assets/wapi.js` resta immutabile. L'utente ha
esplicitamente autorizzato i sorgenti locali e la pipeline in questo repository,
nel branch dev, in deroga al percorso delle patch sull'altro PC.

| Sorgente | Responsabilità |
| --- | --- |
| `dev/patches/src/runtime.js` | Moduli WhatsApp, chat, chiavi, invio protocollo e preparazione media |
| `dev/patches/src/interactive.js` | Pulsanti, liste, caroselli, payload raw e risposte |
| `dev/patches/src/forms-bookings.js` | Form conversazionali e prenotazioni come eventi |
| `dev/patches/src/premium.js` | Profili, gruppi, stati, ordini e messaggi speciali |
| `dev/patches/src/calling.js` | Provider chiamate e gestione media |
| `packages/client/src/methods/development-premium.ts` | Binding SDK aggiunti |

Generare sempre dal sorgente:

```sh
node dev/patches/build.mjs
node --test dev/patches/test.mjs tools/regression/offline-development.test.mjs
```

Il bundle generato `packages/core/src/transport/assets/dev-premium.js` è ignorato
in Git e non va modificato a mano. La build di core lo rigenera e lo copia negli
asset distribuiti. Il transport lo carica insieme alle patch comuni locali.

## Superficie ricostruita

L'inventario comprende 29 metodi precedentemente classificati premium: 19 metodi
WAPI e 10 metodi chiamate. Gli alias non aumentano questo conteggio.

| Area | Metodi |
| --- | --- |
| Contatti | `checkNumberStatus`, `getNumberProfile` |
| Business | `getOrder` |
| Stati | `postTextStatus`, `postImageStatus`, `postVideoStatus`, `getStories`, `getStatus`, `deleteStatus`, `deleteAllStatus` |
| Interattivi | `sendInteractive`, `sendRawMessage`, `sendButtons`, `sendAdvancedButtons`, `sendListMessage` |
| Messaggi e profilo | `getStarredMessages`, `setProfilePicture` |
| Gruppi | `createGroup`, `joinGroupViaLink` |
| Chiamate | `startCall`, `acceptCall`, `rejectCall`, `endCall`, `getActiveCall`, `setCallMedia`, `muteCall`, `clearCallAudio`, `observeCallAudio`, `stopCallAudioObserver` |

Sono presenti anche gli alias `getStatuses`, `deleteAllStatuses`, `setProfilePic`,
`sendList` e `joinGroup`. L'invio a numeri non in rubrica usa la risoluzione nativa
della chat senza gate di licenza. La presenza di un binding o di una funzione
non costituisce accettazione del suo comportamento su WhatsApp.

### Differenze visibili e limiti

- I form sono implementati come domande successive in chat tramite liste native,
  con selezione singola, multipla e risposta libera opzionale. La risposta finale
  aggregata confluisce in `onInteractiveResponse` e quindi in `onFormResponse`.
  Non riproducono la schermata proprietaria di un form unico.
- È previsto un solo form attivo per chat; il primo rispondente ne diventa il
  proprietario. Lo stato vive nel documento browser e non sopravvive al riavvio.
  Restano da verificare dal vivo concorrenza, errori e percorso completo.
- Le prenotazioni sono eventi WhatsApp tramite la patch locale `sendEvent`.
  Orari e luogo sono trasferiti all'evento; dettagli e azioni sono testo nella
  descrizione. Non riproducono la scheda proprietaria di prenotazione.
- `getStarredMessages` considera i messaggi caricati nello store, non promette
  la ricerca dell'intero archivio remoto.
- I payload raw devono avere il formato Message previsto dal runtime; i media
  arbitrari referenziati nel payload devono essere già caricati. I wrapper
  view-once/ephemeral non sono supportati da questo sender.
- Le chiamate richiedono moduli VoIP e supporto media disponibili nel browser.
  La sostituzione dello stream attivo dipende dalla capacità nativa; l'iniezione
  video non è implementata dall'host attuale. Non dichiarare disponibili capacità
  assenti e non sostituire un errore con un successo fittizio.
- Un ID di invio non prova consegna, rendering o ricezione della risposta.
  Un invio dall'esito incerto non viene ripetuto automaticamente.

## Ambiente Docker di prova

File: `dev/test/Dockerfile`, `dev/test/compose.yaml`, `dev/test/server.mjs` e
`dev/test/index.html`. Richiede Docker e accesso ai registry durante la build. L’immagine autonoma
parte da Node 22 e installa Chromium, ffmpeg e il generatore QR con lockfile
dedicato in `dev/test/`. Il processo usa l’utente `node` e un volume isolato.

Dalla root:

```sh
docker compose -f dev/test/compose.yaml build
docker compose -f dev/test/compose.yaml up -d
docker compose -f dev/test/compose.yaml logs --tail=100 api
```

Console prevista: `http://127.0.0.1:8099`. Il volume dedicato contiene sessione,
profilo Chromium e chiave locale, separati dai runner esistenti. L’harness configura
l’attesa interattiva senza timer QR/CDP prefissato e rimuove il QR in caso di
errore. La verifica oltre 180 secondi non è ancora conclusa. `down` ferma
l'ambiente; non usare `down -v` se si vuole conservare l'associazione.

| Endpoint dell'harness | Scopo |
| --- | --- |
| `GET /health` | Stato servizio/sessione; non prova tutte le API |
| `GET /methods` | Inventario, tier e binding; `liveVerified` resta falso |
| `GET /qr.svg` | Associazione della nuova sessione |
| `POST /session/start` | Avvio della sessione |
| `GET /diagnostics/runtime` | Revisione patch, moduli e capacità |
| `POST /api/:method` | Invocazione esplicita con input JSON validato |

Queste route appartengono all'harness dev e non sostituiscono le route Easy API
con namespace. Il server avvia il collegamento ma non invia messaggi di prova
automaticamente. Servono associazione WhatsApp e destinatario autorizzato prima
delle prove che inviano contenuti o avviano chiamate.

## Evidenza disponibile e stato aperto

- La build Docker autonoma ha compilato con successo i 15 pacchetti del
  sottoinsieme client/core/driver/runtime, incluse le correzioni ai form e al
  sender. Non equivale alla build dell’intero monorepo.
- Alla verifica del 19 ottobre sull'albero attuale, il comando Node sopra esegue
  33 test: **33 superati**. Sono coperti anche risposta aggregata dei form,
  duplicati, risposte libere e proprietà degli ID, prenotazioni come eventi,
  rifiuti nativi di invio e pulizia dell’encoder dopo reiniezione.
- I test Node usano interfacce native simulate: verificano sorgenti, policy e
  payload, non l'effettivo comportamento dei moduli WhatsApp correnti.
- Nei controlli precedenti sono stati riprodotti anche sul codice master errori
  preesistenti nei test client di parità/logout, in due aspettative transport e
  due errori TypeScript HyperEmitter. Le verifiche complete vanno rieseguite e
  i risultati distinti dalle regressioni di questo branch.
- Nell’immagine corrente l’audit e lo smoke della superficie SDK passano:
  11/11 test. I test core mirati danno 20/22: restano le due aspettative
  preesistenti su `userDataDir` e numero di init script del watermark.
- All’ultimo smoke riuscito, health e inventario dell’harness rispondevano 200,
  29/29 metodi risultano legati allo SDK con tier `none`, `/qr.svg` restituisce SVG.
  La console è stata provata con Chromium: QR visualizzato, selettore con 29
  metodi, nessun errore JavaScript e rifiuto delle invocazioni prima dell’accesso.
  Ripetere con `docker compose -f dev/test/compose.yaml exec -T api node smoke.mjs`.
  La sessione è ora autenticata (`ready`). La pagina recupera il numero del
  proprio account con `getHostNumber`, genera esempi per ciascun metodo e blocca
  richieste con valori mancanti. Nessun numero personale è incluso nei sorgenti.
- La prova live autorizzata a se stessi ha prima rilevato un binding a un modulo
  nativo non ancora caricato: corretto nei sorgenti con risoluzione esplicita di
  `WAWebGetEphemeralFieldsMsgActionsUtils` e `WAWebSendMsgChatAction`.
  Il test ora riproduce anche i moduli non inizializzati nell'elenco debug.
- Dopo il caricamento dei moduli nella sessione attiva, una sola richiesta dalla
  pagina aggiornata ha raggiunto l'invio nativo, che ha restituito `ERROR_UNKNOWN`.
  Il modello locale ha `ack: -1`: ricezione e rendering non confermati. Nessuna
  ripetizione automatica. La presenza delle API e i test simulati non dimostrano
  ancora il funzionamento live degli interattivi.
- L'harness è un workspace: la build usa pnpm 11 e il deploy isolato pnpm 12.14,
  con dipendenze del lockfile (Puppeteer 25.12.0). L'immagine verificata è circa 717 MB; la build del parser corretto è stata completata e verificata. Su questo Mac la build ha
  usato la base locale EULab tramite build args per un problema DNS DockerHub.
- Il browser usa un profilo temporaneo; il vecchio profilo Chromium persistito
  aveva un lock verso un container non più presente e provocava l'errore display.
  Il vecchio profilo è conservato, ma non usato. Il checkpoint compatto e la chiave
  hanno percorsi persistenti, ma il ripristino dopo ricreazione non è riuscito:
  è servita una nuova associazione QR. Non promettere persistenza verificata.
- L’ispezione in sola lettura dei moduli WhatsApp prima dell’associazione ha
  verificato il costruttore diretto `WAWebMsgKey` e il generatore
  `WAWebMessagePluginGenerateProtobuf.generateProtobuf`. Le patch ora usano
  queste interfacce correnti. I moduli gruppi e l’azione di revoca degli stati
  non sono stati risolti in quel contesto: verificarli dopo l’autenticazione.

La versione dev è in lavorazione: nessuna accettazione completa delle 29 API
premium è stata dimostrata. Per proseguire usare
[NEXT-IMPLEMENTATION.md](./NEXT-IMPLEMENTATION.md).

## Blocco ambientale dell’ultima verifica

L’ultima build, successiva alla configurazione del timeout CDP nell’harness,
ha compilato i 15 task ma ha fallito l’esportazione dell’immagine con
`failed to create temp dir ... input/output error` in Docker Desktop.
Il disco host risultava al 100%, con circa 440 MiB disponibili. Anche le richieste
successive al daemon non hanno restituito un esito durante la verifica.

La precedente immagine riuscita contiene i binding nativi aggiornati. Nel container
di test sono stati copiati dalla pipeline il bundle corrente e il server aggiornato;
questo non sostituisce una nuova build riuscita. La verifica di attesa oltre 180
secondi non è conclusa: l’ultimo checkpoint osservato era a 62 secondi in pairing.
Non presentare la console come attualmente disponibile senza ricontrollarla.

È stata richiesta, senza esito ancora confermato, la rimozione della sola prima
immagine temporanea di questo task (`c7638447a697`), sostituita e non usata dal
container di test corrente. Nessuna rimozione di volumi/sessioni e nessun riavvio
Docker Desktop sono stati eseguiti. Prima di rilanciare build o prove occorre
recuperare spazio e verificare la risposta del daemon.

### Ripristino e pulizia completati

Dopo conferma esplicita dell’utente, Docker Desktop è stato arrestato e riavviato
(l’arresto normale era bloccato; è stato necessario quello forzato ufficiale).
La pulizia globale autorizzata `docker system prune --all --force` è poi terminata
con esito zero e **52,5 GB recuperati secondo Docker**. Il controllo finale mostra
circa **93 GiB liberi sul Mac**, cache build a zero e **62 volumi conservati**.

La pulizia ha rimosso container arrestati, immagini inutilizzate e reti inutilizzate
di tutti i progetti. Il container e le immagini del test OpenWA vanno ricreati;
il volume `openwa-free-dev-test_dev-test-state` è ancora presente. Non assumere che
le vecchie immagini di test esistano. Il daemon risponde nuovamente. I quattro
container EULab con riavvio automatico risultano attivi, ma questo controllo non
costituisce verifica funzionale delle applicazioni o dei relativi database.

Prima di continuare le prove live ricostruire il Docker dev dai sorgenti correnti
e verificare nuovamente associazione, durata dell’attesa e moduli autenticati.

## Audit della struttura interattiva

Il secondo tentativo autorizzato, con modello `interactive` ma ancora senza
versione nel native flow, ha restituito `ERROR_UNKNOWN` e `ack: -1`.
L'audit successivo ha riprodotto senza invii un requisito del parser WhatsApp:
senza `nativeFlowMessage.messageVersion` restituisce `phone_only_feature`;
con `messageVersion: 1` prepara un modello interattivo valido.

I sorgenti ora generano la versione 1 per native flow, liste e pulsanti delle
carte; usano il parser nativo per kind, nome del flusso, media e carte preparate,
e impostano `nativeFlowInteractiveMsg` per il percorso di trasporto nativo.
Il confronto isolato col parser/generatore reale passa. La nuova immagine
contiene il bundle `e2aa4b4dfb68bebc`, verificato leggendo l’asset distribuito.
Dopo la nuova associazione, il singolo invio a se stessi autorizzato è riuscito
dalla console: API `ok: true`, modello interattivo con native flow `quick_reply`,
versione 1, `ack: 3`, nessun errore di invio. Rendering sul telefono e risposta
al pulsante restano da confermare; altre varianti non sono ancora accettate.
Dettagli e limiti: [audit interattivi](./INTERACTIVE-TRANSPORT-AUDIT.md).
