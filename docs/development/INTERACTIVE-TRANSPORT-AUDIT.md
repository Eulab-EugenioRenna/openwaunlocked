# Audit del trasporto interattivo dev

Verifica del 19 ottobre 2026, WhatsApp Web `2.3000.1050814928`.

## Contratto originale e limiti documentati

Fonte principale: [guida originale OpenWA V5](https://openwa.dev/docs/guides/interactive-messages).
La guida distingue documento OpenWA, protobuf costruito, preparazione del modello
WhatsApp ed effettivo invio cifrato/fanout. Non promette che un JSON valido sia
abilitato per qualsiasi account o venga visualizzato da ogni destinatario.
I limiti da mantenere sono:

- Reply e CTA vanno separati; gli ID devono essere stabili e univoci negli ambiti
  documentati. I click URL/telefono/copia non garantiscono eventi di risposta.
- I media dei messaggi tipizzati devono essere caricati; un payload raw non
  carica automaticamente i media e non è il formato alto livello Baileys.
- Il parser deve poter preparare il payload. Wrapper view-once/ephemeral non
  sono supportati dal contratto raw originale. Versioni e capability contano.
- Form nativi e booking card hanno un contratto differente dalle liste successive
  e dagli eventi usati attualmente dal dev: la parità non è stata raggiunta.
- Un ID di invio non prova rendering o risposta. Non aggiungere retry automatici.

Non emerge dalla guida un obbligo generale di account Business per tutti i pulsanti
V5: non attribuire il rifiuto a questa causa senza evidenza. Le restrizioni della
Cloud API non si trasferiscono automaticamente a una sessione WhatsApp Web.
La licenza OpenWA non sostituisce i controlli nativi di WhatsApp.

## Differenze strutturali verificate sul runtime

| Livello | Implementazione iniziale | Correzione nei sorgenti |
| --- | --- | --- |
| Moduli lazy | Ricerca dei soli export già inizializzati | Risoluzione esplicita dei moduli ephemeral e send |
| Modello locale | `chat` anche per gli interattivi | `interactive` |
| Versione protocollo | Assente nei native flow | `messageVersion: 1`, anche nelle carte |
| Preparazione | Ricostruzione parziale dei campi | `WAWebParseInteractiveMessageProto` e rifiuto dei risultati non interattivi |
| Kind/nome/header/media/carte | Campi derivati incompleti | Risultato del parser nativo conservato nel modello |
| Stanza business | Marcatore assente | `nativeFlowInteractiveMsg` per native flow |

Il parser reale, chiamato soltanto con input sintetico e senza sender, restituisce
`type: unknown`, `kind: unknown`, `subtype: phone_only_feature` quando manca la
versione. `isSupportedInteractiveMessageVersion` restituisce false senza versione
e true per versione 1. Questo limite è confermato, non dedotto dal solo errore HTTP.

Il costruttore nativo del fanout legge `msgRecord.data.nativeFlowInteractiveMsg`:
insieme al nome ricavato dal protobuf seleziona la struttura annidata
`biz > interactive(type=native_flow) > native_flow`, invece dell'attributo piatto
`native_flow_name`. Non si aggiungono manualmente nodi bot o un'identità business:
si usano i metadati del modello per lasciare cifratura/fanout al client nativo.

## Evidenza e limiti attuali

- 33 test locali passano, con immutable WAPI verificato e nessuna verifica licenza.
- Il nuovo sorgente, eseguito su API isolata con sender sostituito da una cattura
  in memoria, passa parser e generatore reali: type/kind interactive, versione 1,
  nome quick_reply e marcatore native flow presenti. Nessun invio in questa prova.
- Due invii precedenti autorizzati a se stessi hanno restituito ERROR_UNKNOWN e
  ack -1. Il secondo aveva il modello corretto ma non la versione richiesta.
- La prova successiva, autorizzata separatamente e inviata una sola volta dalla
  console al proprio account, è riuscita con bundle `e2aa4b4dfb68bebc`: risposta
  API `ok: true`, modello `interactive`, kind `interactive`, native flow
  `quick_reply`, versione 1, `ack: 3`, `isSendFailure: false`.
  Rendering sul telefono e pressione del pulsante non sono ancora confermati.
  Questo esito riguarda un messaggio con un pulsante reply a se stessi, non tutte
  le varianti interattive né un destinatario su un secondo account.
- Il runtime blocca WAPI dopo installazione: aggiornare immagine e riavviare il
  test, senza modificare wapi.js. La sessione dev non si è ripristinata dal
  checkpoint nell'ultima ricreazione; è stata nuovamente associata via QR.

Non descrivere tutte le API premium come funzionanti sulla sola base dei test
simulati o della rimozione della classificazione di licenza.

## Conferma manuale sul destinatario e prova con due pulsanti

L'utente ha confermato che, inviando a un altro account, il pulsante è cliccabile.
Nella chat con se stessi vedeva invece il pulsante ma non riusciva a premerlo sul
telefono. Sul modello reale il payload non marcava il pulsante come disabled e
il costruttore di azioni WhatsApp Web lo considerava abilitato. Non estendere
questo comportamento Web al telefono e non considerare il self-send una prova
completa della risposta. La ricezione dell'evento nel SDK non è stata verificata.

La console ora propone due azioni reply nello stesso messaggio: Conferma
(`test_confirm`) e Annulla (`test_cancel`). La posizione effettiva dei pulsanti
è gestita dall'app WhatsApp del destinatario. Non inserire un numero personale
nei sorgenti. Il destinatario della nuova prova è stato autorizzato esplicitamente.

La prova con due pulsanti reply è stata inviata una sola volta dalla console a
un secondo account autorizzato: API `ok: true`, `ack: 2`, `isSendFailure: false`,
versione protocollo 1, azioni quick_reply Conferma e Annulla con ID distinti.
L'invio e la consegna risultano confermati; disposizione sul telefono e risposte
ai due pulsanti richiedono ancora conferma manuale e verifica degli eventi SDK.
Il numero del destinatario è rimasto fuori dai sorgenti.

## Audit successivo delle altre API

La matrice aggiornata è in [PREMIUM-AUDIT.md](./PREMIUM-AUDIT.md).
Il parsing isolato ha rilevato che single_select non produce un nome native flow
nel runtime corrente: liste e form usano ora listMessage/listType 1 tramite il
parser lista nativo. Sono state rilevate due risposte reali al messaggio con due
pulsanti: il decoder isolato produce reply conformi allo schema e conserva il
riferimento originale. Il consumer SDK/SSE resta da collaudare.
