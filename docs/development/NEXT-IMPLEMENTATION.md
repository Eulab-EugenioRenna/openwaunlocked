> Ripartire da [PREMIUM-AUDIT.md](./PREMIUM-AUDIT.md) e dal nuovo
> [contratto audio IVR/agente esterno](./VOICE-API.md). La conversazione audio
> bidirezionale è confermata dall'utente il 20 ottobre. Il motore vocale resta esterno;
> video e 50 conversazioni simultanee non sono collaudati. Le sezioni sotto
> conservano anche le attività storiche: non ripetere gli invii già eseguiti.

# Prossima implementazione del branch dev

Punto di ingresso: [stato e contratto dev](./free-use-offline.md).
Branch da mantenere: `dev/free-use-offline`. Non modificare `wapi.js`, non
trasferire modifiche su master/release e non pubblicare pacchetti in questo task.
Le modifiche implementative recenti sono ancora nell'albero di lavoro: leggere
`git status` e i diff prima di intervenire; non sovrascriverli.

## 0. Ripristinare la possibilità di eseguire Docker

- [x] Ripristinare spazio e daemon: pulizia globale completata dopo autorizzazione
  esplicita; 52,5 GB recuperati secondo Docker, circa 93 GiB liberi sul Mac.
- [x] Verificare la pulizia: cache a zero, 62 volumi conservati; immagini e
  container del test rimossi dalla pulizia globale autorizzata.
- [x] Conservare volumi e sessioni. Il riavvio Docker Desktop è stato autorizzato
  ed eseguito; non è stato eseguito un reset del disco Docker.
- [x] Ricostruire l’immagine dopo il ripristino: export riuscito anche dopo le ultime correzioni di parsing degli interattivi.
- [ ] Verificare che l’attesa QR superi 180 secondi e rieseguire lo smoke console.

## 1. Stabilizzare form e listener

- [x] Aggiornare il mock dello store in `dev/patches/test.mjs` per supportare più
  listener sullo stesso evento e attendere le callback asincrone.
- [x] Sostituire il test che pretende il rifiuto di form/booking con prove del
  workflow attuale, mantenendo le verifiche di errori e assenza di invii duplicati.
- [x] Dopo reiniezione verificare rimozione dei vecchi callback senza pretendere
  l'assenza del nuovo listener interno dei form.
- [x] In `forms-bookings.js` verificare la coda del primo invio prima delle
  risposte e gestire gli ID delle domande senza collisioni con proprietà Object
  (ad esempio `__proto__`).
- [ ] Provare selezioni multiple, testo libero, duplicati, rispondenti concorrenti,
  errori di invio e pulizia al cambio documento. Non aggiungere retry automatici.
- [x] Rieseguire `node --test dev/patches/test.mjs tools/regression/offline-development.test.mjs`.

## 2. Ricostruire e avviare l'ambiente

- [x] Rigenerare il bundle dai sorgenti e ricostruire l'immagine dopo le modifiche.
- [x] Avviare il compose dedicato; verificare log, health, QR e dipendenze runtime
  come `qrcode`. L’immagine autonoma corrente include i form e il sender corretti.
- [x] Verificare associazione di una sessione dev isolata senza cambiare sessioni,
  profili o dati dei runner EULab già presenti.
- [ ] Controllare che revisione patch caricata e sorgenti della build coincidano;
  verificare l'intercettazione delle richieste OpenWA.

## 3. Validare le API sui moduli effettivi

Prima delle operazioni con effetti esterni ottenere una chat/destinatario di
prova autorizzato. Non usare numeri trovati nello store come consenso all'invio.

| Gruppo | Prova richiesta |
| --- | --- |
| Contatti e profilo | Numero valido/assente; profilo e aggiornamento foto con esito nativo |
| Ordini e preferiti | Ordine reale accessibile; ambito dei preferiti caricati documentato |
| Stati | Testo/colori/font, immagine, video, lettura e cancellazione solo propri stati |
| Gruppi | Creazione e ingresso con partecipanti/invito esplicitamente autorizzati |
| Interattivi | Pulsanti, URL/telefono/copia, liste, caroselli e media visibili al destinatario |
| Form e booking | Percorso completo, risposta aggregata, evento con orari e luogo corretti |
| Raw | Fedeltà payload, byte base64 e rifiuto input non supportati |
| Chiamate | Avvio/accettazione/rifiuto/fine, identità, audio, mute e pulizia risorse |

Controllare in particolare l'accesso allo store nativo di `getStatus`, la
risoluzione PN/LID, il caricamento media e le firme dei moduli VoIP.
Il binding di `WAWebMsgKey` e quello di `generateProtobuf` sono stati aggiornati
con evidenza dalla pagina WhatsApp reale; i moduli di gruppi e revoca stati
restano da risolvere e verificare dopo l’associazione. Non assumere
che i nomi presenti nei mock esistano nella versione WhatsApp autenticata.
Per ogni prova registrare build/revisione, input senza dati sensibili, risultato,
ID quando applicabile, ricezione/rendering e limiti. Non trasformare la sola
presenza del metodo o il valore `license: none` in un esito funzionale positivo.

## 4. Chiusura tecnica

- [ ] Eseguire build e test mirati del client/core e audit della superficie runtime.
- [ ] Separare regressioni introdotte, errori preesistenti e verifiche non eseguibili.
- [ ] Aggiornare il documento di stato con risultati attuali e prove live mancanti.
- [ ] Verificare hash immutabile, diff completo, assenza di segreti e bundle generati
  dal contenuto da versionare. Controllare che i nuovi sorgenti non siano ignorati.
- [ ] Se si creano commit, usare gruppi atomici e gitmoji Conventional Commits;
  verificare lo stato dopo ogni commit. Nessun push o rilascio è stato richiesto.

Non dichiarare completate tutte le API finché la relativa matrice di accettazione
non è stata eseguita oppure i limiti residui non sono stati concordati con l'utente.

### Ultimo incremento: console e primo tentativo live

La console è stata aggiornata nel container senza interrompere la sessione.
Il numero del proprio account viene ricavato a runtime, i parametri cambiano col
metodo e i campi null bloccano l'esecuzione. Non salvare il numero nei sorgenti.
33/33 test locali passano, inclusi moduli nativi non ancora caricati e rifiuto
pre-invio dei payload interattivi non preparabili dal parser.

Due tentativi live autorizzati hanno restituito `ERROR_UNKNOWN` e `ack: -1`.
Il secondo usava la revisione `9bd9c25ebc06c8ff` con il modello `interactive`,
ma senza `messageVersion` nel native flow. Non ripetere automaticamente gli invii.
Il parser reale ha permesso di riprodurre il limite strutturale: versione mancante
produce `phone_only_feature`; versione 1 permette il parsing. I sorgenti ora
usano il parser completo e il marcatore native flow per la stanza biz.
Confronto isolato con parser e generatore reali riuscito, senza invii.
Vedere [INTERACTIVE-TRANSPORT-AUDIT.md](./INTERACTIVE-TRANSPORT-AUDIT.md).

WAPI è bloccato dopo l'avvio: non tentare la sostituzione a caldo della patch.
Il tentativo ha eseguito cleanup prima di fallire sulle proprietà immutabili;
il container è stato quindi ricreato dall'immagine. Il ripristino del checkpoint
non è riuscito e l'utente ha associato nuovamente il QR. Sessione ora `ready`.
La prossima build deve includere la correzione del parser e bisogna coordinare
l'eventuale nuova associazione prima di altre prove autorizzate.
