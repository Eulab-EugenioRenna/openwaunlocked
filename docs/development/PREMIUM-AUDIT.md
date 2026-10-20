# Audit rapido delle 29 API premium dev

Branch: `dev/free-use-offline`. Data: 19 ottobre 2026.
WhatsApp Web: `2.3000.1050814928`.

## API per motore vocale esterno: 20 ottobre 2026

Esportata `createVoiceCallAudio` da `@eulab/openwaunlocked-runtime-node`: ascolto PCM
continuo, risposte progressive con backpressure, conversione della frequenza,
interruzione della risposta senza chiudere l'ascolto, metriche e rilascio stream.
Contratto e limiti in [VOICE-API.md](./VOICE-API.md). Nessun modello installato.

Corretti due difetti verificati nell'integrazione: la chiusura di uno stream
microfono in attesa poteva bloccare la fine chiamata; un clear durante la
scrittura poteva lasciare ripartire i frame residui del vecchio blocco.
Ora il lettore viene cancellato prima dell'attesa della fibra e i blocchi
precedenti al clear vengono scartati, prima dello svuotamento nativo.

Build e 81 test mirati superati: 57 Node, 12 SDK, 2 core, 10 helper audio.
I due nuovi scenari SDK/core/host Node verificano avvio senza TTS, ricezione
durante risposta e interruzione, risposta successiva e chiusura senza nuovi
campioni, oltre alla regressione sul clear di un blocco lungo. Provider
WhatsApp simulato: nessuna nuova chiamata reale, nessuna prova con motore vocale esterno o video.
L'immagine è costruita senza riavviare il container della sessione esistente;
nessun pacchetto pubblicato. Le prove fisiche ancora aperte restano tali.

## Chiamata con audio bidirezionale confermata il 20 ottobre 2026

L'utente ha eseguito una chiamata e confermato audio funzionante in entrambe
le direzioni PC browser ↔ telefono. Il registro SDK mostra chiamata uscente
calling → ringing → active, media attached, quindi ended. Il motivo di fine
osservato è WHATSAPP_CALL_ENDED: non certifica l'uso dell'API endCall.

La conversazione audio bidirezionale è quindi accettata per questa prova reale.
Restano da collaudare fisicamente accettazione/rifiuto in ingresso, mute/unmute,
interruzione, cambio sorgente, osservatori/registrazione, stabilità prolungata,
nonché le varianti interattive e le altre API ancora aperte nella matrice.
Non è una certificazione dell'intero IVR o di tutte le API premium.

Al controllo successivo la demo risultava nuovamente in pairing, senza failure;
nessun riavvio o intervento sulla sessione è stato effettuato dall'agente.

## Sessione ricollegata: verifica del 20 ottobre 2026

Sessione pronta, WhatsApp Web `2.3000.1050960581`, bundle
`c5f21137a5c1f8ab` caricato. Nessun riavvio o nuova associazione eseguiti.

- Smoke della pagina servita superato: 29 metodi esposti, 45 prove singole.
- Audit reale SDK/HTTP superato: numero, profilo, info contatto, storie,
  preferiti, chiamata attiva e disponibilità rispettano gli schemi. Storie e
  preferiti vuoti: nessuna prova positiva di recupero storico.
- Ordine inesistente e identità di chiamata scadute respinti come previsto.
- Audit isolato degli stessi sorgenti sui moduli WhatsApp reali superato.
- Fixture driver nativi: cattura Ready, segnale in ingresso/uscita,
  23040 campioni scritti, 4096 ricevuti in 4 frame accettabili dal core.
  Il gate disponibilità resta sostituito nella fixture, che non chiama nessuno.

Nessun messaggio inviato e nessuna chiamata reale effettuata durante questi
controlli. Resta da confermare la conversazione PC ↔ telefono e le prove con
effetti reali della matrice sottostante. Nessuna accettazione completa implicita.

## Verifica risposte native e strumento di audit

Corretto il listener delle risposte: un parametro JSON null causava TypeError;
ora i valori JSON non oggetto vengono preservati come risposta native e non
interrompono l'elaborazione delle risposte successive. Regressione vista prima
fallire e poi passare. Bundle `c5f21137a5c1f8ab`.

La build passa 69 test (55 Node, 12 SDK, 2 core). L'audit isolato è stato adattato
alla CSP WhatsApp e il controllo browser ne verifica l'esecuzione su una pagina
con unsafe-eval vietato, mantenendo l'oggetto WAPI originale. Queste sono prove
simulate: associazione QR e verifiche fisiche della matrice restano aperte.

## Verifica aggiuntiva del formato audio e del ciclo IVR

Corretto un ulteriore scarto sistematico in ricezione: il callback nativo da
2048 campioni a 16 kHz dura 128 ms, oltre il limite core di 120 ms. La patch
`f7a50d2b55fad069` suddivide i blocchi conservando segnale e timeline; regressione
verificata prima in errore e poi verde a 16/48 kHz. Corretto anche il conteggio
degli scarti del bridge per audio già riconosciuto dal browser.

Passano 68 test dedicati (54 Node, 12 SDK, 2 core), inclusi scenari completi SDK /
core / host Node per accettazione, rifiuto, mute/unmute, ricezione, osservatori,
cambio sorgente e chiusura, con provider nativo simulato. Nessun nuovo invio o
chiamata reale eseguito. Associazione QR e accettazione fisica restano necessarie.

## Aggiornamento avvio stream dopo seconda prova

La seconda prova reale è ancora muta: la conversazione non è accettata.
Un test completo SDK/core/host Node/bridge riproduce la chiusura del media quando
lo snapshot di avvio è inizialmente vuoto. Corretto il core; avvio normale e
ritardato, segnale in entrambe le direzioni, clear e hangup passano con provider
simulato. Build: 64 test (50 Node, 12 SDK, 2 core). La verifica fisica resta aperta.
Dettagli in [demo di collaudo](./DEMO-COLLAUDO.md).

## Aggiornamento audio dopo collaudo umano

La prima chiamata reale si è collegata ma era muta in entrambe le direzioni.
Questo risultato smentisce una accettazione dell'audio basata sui soli test SDK.
Il provider è stato corretto per i driver nativi di cattura/riproduzione Web Audio
/WASM e per l'assenza di dispositivi fisici nel container. La regressione senza
dispositivo è stata vista fallire prima del fix. Con il nuovo sorgente, una
fixture isolata su driver WhatsApp reali rileva segnale in entrambe le direzioni:
23040 campioni scritti, 4096 campioni ricevuti, cattura Ready. Il gate di
abilitazione è sostituito nella fixture e non viene effettuata alcuna chiamata.
Build con 62 test superati (48 Node, 12 SDK, 2 core). Bundle `f3b4f54ae77112d7`.
Resta da confermare l'audio PC ↔ telefono dopo l'attivazione.

## Aggiornamento demo di collaudo

La demo ora espone 45 prove individuali, registro dei consumer SDK e ponte
microfono browser PCM per il collaudo chiamate/IVR. La nuova build passa 61 test
(47 Node, 12 SDK, 2 core); schemi dei 45 esempi e UI desktop/mobile sono verificati
anche nell'immagine finale. Lo smoke della pagina servita passa. Il container è
stato aggiornato ed è in attesa di nuova associazione QR. Nessun nuovo invio o
chiamata reale è stato effettuato. I limiti delle prove fisiche sotto rimangono.
Guida operativa: [demo di collaudo](./DEMO-COLLAUDO.md).

## Risultato dell'audit precedente

44/44 test Node passano. La build dedicata compila i 15 task client/core/driver/runtime;
12/12 test SDK della superficie e inoltro parametri e 2/2 test core del ciclo patch passano.
Non è una build/test completa dell’intero monorepo.

Le letture corrette sono state eseguite su API isolate con i moduli WhatsApp reali:
numero, profilo, info contatto, storie e preferiti rispettano i rispettivi schemi.
La lista di storie varia durante la sincronizzazione: il conteggio non è una metrica
statica né una prova di sincronizzazione completa. Il caso preferiti ha restituito
un array vuoto; il caso positivo e la risoluzione PN/LID sono testati nei mock.

La preparazione e l’upload di immagini e video sintetici sono riusciti senza
invio in chat o pubblicazione come stato. Il parser reale accetta reply, CTA URL,
azioni native e il nuovo formato lista con sender sostituito da cattura in memoria.
Sono state trovate anche due risposte reali correlate ai pulsanti autorizzati:
il decoder isolato le riconosce come reply e rispettano lo schema, con riferimento
al messaggio originale. La consegna degli eventi a un consumer SDK/SSE non è
ancora una prova eseguita.
La verifica negativa delle otto azioni su chiamate scadute restituisce STALE_CALL;
non è stato chiamato alcun destinatario.

## Matrice completa

| API | Evidenza | Esito e limite |
| --- | --- | --- |
| `checkNumberStatus` | API live + schema | Passa sul proprio numero. |
| `getNumberProfile` | Sorgente su runtime reale + schema | Corretto ID miniatura nel DTO; nuova immagine da attivare. |
| `getOrder` | Regressione + firma nativa | Corretti parametri oggetto, ricerca order ID e DTO prodotti/importi; manca un ordine reale autorizzato. |
| `postTextStatus` | Regressione + firma nativa | Sender dedicato e conferma OK; nessuno stato pubblicato. |
| `postImageStatus` | Upload fixture + regressione | OpaqueData, metadati e firma oggetto con LID corretti; pubblicazione non provata. |
| `postVideoStatus` | Upload fixture + regressione | Video sintetico preparato/caricato; durata protocollo intera; pubblicazione non provata. |
| `getStories` | Sorgente su runtime reale + schema | Corretto array di Promise/serializer chat: DTO stato completo, tutti i record letti validi. |
| `getStatus` | Sorgente su runtime reale + schema | Corretto getStatus({wid,tcToken}); lettura riuscita. |
| `deleteStatus` | Regressione + firma nativa | Preflight batch; costruzione/cifratura nativa, rimozione locale dopo conferma; nessuno stato utente cancellato. |
| `deleteAllStatus` | Regressione | Seleziona esclusivamente i modelli propri e usa il percorso di revoca corretto; non eseguita sui dati esistenti. |
| `sendInteractive` | Live manuale parziale + parser reale | Uno/due reply consegnati e cliccabili da altro account. Liste/CTA/native: parsing isolato. Form/booking/carousel/media richiedono accettazione completa. |
| `sendRawMessage` | Live tramite reply + regressione | Verificato il percorso degli interattivi; non tutte le classi protobuf, campi sconosciuti/mappe o media raw arbitrari. |
| `sendButtons` | Regressione | Binding e compilazione reply corretti; invio standalone tramite questa API non provato. |
| `sendAdvancedButtons` | Upload fixture + regressione | Preparazione immagine corretta; invio/rendering delle varianti media da verificare. |
| `sendListMessage` | Parser reale + regressione | Single_select non produceva nativeFlowName: ora usa listMessage/listType 1 e parser lista nativo; consegna/clic da verificare. |
| `getStarredMessages` | API vuota + schema / regressione positiva | Corretti await serializer e risoluzione PN/LID. Non è prova di recupero storico completo dei preferiti. |
| `setProfilePicture` | Firma nativa verificata | Crop e bridge implementati; non sostituita la foto del profilo personale per collaudo. |
| `createGroup` | Loader reale + regressione | Carica il bundle prima del job; nessun gruppo o partecipante creato. |
| `joinGroupViaLink` | Loader reale + regressione SDK | Corretto gid, host invito e inoltro returnChatObj; manca invito a gruppo di prova. |
| `getActiveCall` | Binding nativo corretto + regressione | Legge WAWebCallCollection diretto; transizioni calling/ringing/active/ended osservate nelle prove reali. Questo non prova il media. |
| `startCall` | Input negativo + regressione provider | Chiamata uscente reale con media attached e audio bidirezionale confermato dall’utente il 20 ottobre; stabilità prolungata ancora da collaudare. |
| `acceptCall` | Rifiuto live STALE_CALL + regressione | Nessuna chiamata reale accettata. |
| `rejectCall` | Rifiuto live STALE_CALL + regressione | Nessuna chiamata reale rifiutata. |
| `endCall` | Rifiuto live STALE_CALL + regressione | Nessuna chiamata reale terminata. |
| `muteCall` | Rifiuto live STALE_CALL + regressione | Proprietà tracce provate nei mock; audio reale da collaudare. |
| `clearCallAudio` | Rifiuto live STALE_CALL + regressione | Pulizia code provata nei mock; audio reale da collaudare. |
| `setCallMedia` | Rifiuto live STALE_CALL + regressione | Sostituzione fallita conserva il proprietario precedente nei test; media reali da collaudare. |
| `observeCallAudio` | Rifiuto live STALE_CALL | Ricezione audio reale da collaudare. |
| `stopCallAudioObserver` | Rifiuto live STALE_CALL | Arresto osservatore reale da collaudare. |

Gli alias seguono gli stessi binding. `getCallCapabilities`, non incluso nelle 29
API già premium, risponde e rispetta lo schema; indica disponibilità, non prova
una conversazione audio/video. La camera video iniettata resta non supportata.

## Correzioni aggiuntive di protezione

- Il provider chiamate usa la collezione nativa diretta, non l’alias Store.Call assente.
- I test di regressione usano il trasformatore esbuild già fornito da tsx: il compilatore TypeScript 7 del lockfile non espone transpileModule/ModuleKind.
- I moduli non caricati non vengono memorizzati come undefined.
- La patch rifiuta l’installazione su WAPI bloccato prima di eseguire cleanup.
- Non sono stati aggiunti retry automatici di invii o creazioni.
- `wapi.js` è immutato; il bundle è generato da `dev/patches/src`.
- Nessun numero di prova, token, profilo o contenuto WhatsApp è stato inserito
  nei sorgenti o in questo rapporto.

## Attivazione e verifiche rimanenti

Il precedente container autenticato usava `e2aa4b4dfb68bebc` (quella dei due
pulsanti verificati). È stato sostituito con la nuova immagine
`openwa-free-dev-test:local`, con bundle `dd0421d872464a83` e demo aggiornata;
la sessione è in attesa di nuova associazione QR.
Non è stato tentato un aggiornamento a caldo: WAPI è bloccato e i suoi listener
non devono essere smontati. La ricreazione precedente richiedeva una nuova
associazione QR, perché il checkpoint della sessione dev non si ripristina ancora.

Dopo attivazione/associazione eseguire:

```sh
node --test dev/patches/test.mjs tools/regression/offline-development.test.mjs
docker compose -f dev/test/compose.yaml exec -T api node smoke.mjs
docker compose -f dev/test/compose.yaml exec -T api node audit.mjs
docker compose -f dev/test/compose.yaml exec -T api node native-audit.mjs
```

`audit.mjs` controlla il vero SDK/HTTP, gli schemi e i rifiuti di identità scadute;
restituisce exit 1 se trova difetti. `native-audit.mjs` verifica i sorgenti su un
oggetto API isolato: non sostituisce WAPI e non invia messaggi. Le due prove non
vanno confuse: prima dell’attivazione la vecchia API HTTP mantiene i difetti già
corretti nel sorgente isolato.

Per chiudere le prove con effetti reali servono una sessione/account di collaudo,
media e un ordine reale accessibile, un gruppo con invito dedicato e un secondo
partecipante per audio/video. Non usare gli stati o il profilo personale esistenti
come dati da distruggere; non ripetere invii incerti senza nuovo consenso.
Non dichiarare tutte le API funzionanti sulla base di questa matrice.

Riferimenti: [audit interattivi](./INTERACTIVE-TRANSPORT-AUDIT.md),
[prossima implementazione](./NEXT-IMPLEMENTATION.md),
[guida originale OpenWA](https://openwa.dev/docs/guides/interactive-messages),
[sorgente di riferimento media](https://github.com/wwebjs/whatsapp-web.js/blob/main/src/util/Injected/Utils.js).
Le firme del runtime effettivo prevalgono sui nomi/parametri obsoleti dei riferimenti.
