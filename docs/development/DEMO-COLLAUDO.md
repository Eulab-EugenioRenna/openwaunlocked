# Collaudo individuale della demo

La pagina su `http://localhost:8099` contiene 45 prove singole che coprono le
29 API della matrice premium, più `getCallCapabilities`. Nessuna scheda viene
eseguita automaticamente. L'esecutore JSON generale rimane disponibile.

## Uso

1. Collega la sessione WhatsApp e inserisci il destinatario con prefisso internazionale.
2. Compila i dati comuni: immagine (anche caricabile dal computer), video,
   documento, URL audio, URL azione/invito, numero telefono, ordine o stato.
3. Nella scheda interessata premi **Prepara con i dati attuali**, controlla il
   JSON e premi **Esegui una volta**. La preparazione non invia nulla.
4. Controlla l'effetto sul secondo telefono. Imposta la conferma o il fallimento
   fisico sulla scheda. La riuscita HTTP non conferma consegna, rendering o audio.
5. Esporta il report prima di chiudere o ricaricare la pagina. Gli esiti manuali
   sono mantenuti solo nella pagina corrente.

Il registro mostra eventi ricevuti dai listener SDK per risposte interattive,
form e chiamate. Controlla ID della scelta e riferimento al messaggio originale.
Il registro server conserva al massimo 200 eventi in memoria; il riavvio lo
azzera. Non è un archivio delle conversazioni. Il report esportato può contenere
identificatori e contenuti ricevuti: conservalo come dato di collaudo privato.

## Chiamate e IVR

Servono due account/telefoni. Non occorre sviluppare STT, LLM o TTS per collaudare
il ponte audio. Il media predefinito trasmette un tono WAV continuo e registra la
ricezione in `/state/demo-received-<timestamp>.wav`. Un URL audio HTTP(S) può
sostituire il tono; formati/protocolli proprietari richiedono un adattatore.

- Chiamata uscente: prepara **Avvia**, esegui, rispondi dal secondo telefono.
- Ingresso: chiama l'account demo, premi **Aggiorna chiamata attiva**, poi prepara
  ed esegui **Accetta**. Ripeti con una nuova chiamata per **Rifiuta**.
- Durante la chiamata prepara/esegui mute, unmute, clearCallAudio e setCallMedia;
  controlla l'effetto sul secondo telefono e la continuità della ricezione.
- Avvia un osservatore, usa l'observerId restituito per fermarlo e verifica che
  la chiamata rimanga attiva.
- Termina, aggiorna le registrazioni, ascoltale e usa **Verifica stream registrato**:
  vengono misurati codec, frequenza, canali, durata e volume nei primi 60 secondi.
  Un file valido non dimostra da solo intelligibilità o assenza di perdite.
- Completa la checklist IVR: saluto/ascolto/risposta, interruzione, ripresa,
  stabilità per almeno 5 minuti, chiusura da entrambi i lati e nuova chiamata.

Per una conversazione umana usa **Conversazione · microfono del browser**:
prepara il microfono (cuffie consigliate), poi chiama o accetta dopo aver letto
l'identità attiva. Il ponte usa stream applicativi PCM16 mono a 16 kHz e mostra
pacchetti, campioni, picco di segnale e scarti nelle due direzioni. Il trasporto
HTTP della demo ha code limitate e non è un benchmark della latenza ottenibile
con un adattatore WebSocket dedicato. Il microfono richiede localhost o HTTPS.

Puoi usare mute/unmute, clearCallAudio, osservatori e chiusura anche con questo
ponte. Un cambio sorgente sostituisce il ponte: per tornare al microfono remoto
arresta il ponte e prepara una nuova chiamata. **Arresta ponte audio** libera il
microfono ma non termina automaticamente la chiamata. Il ponte scade dopo 15
secondi senza richieste, oppure viene liberato alla chiusura della pagina.
L'accettazione/start non vengono ritentati; in caso di esito incerto controlla
prima la chiamata. La gestione automatica di turni/VAD/LLM resta fuori dalla demo.
La prova barge-in manuale non certifica l'orchestrazione di un futuro agente.
Le API non espongono un listener DTMF in questa demo.

## Limiti di accettazione

Usa account e contenuti di prova per modifica profilo, gruppi e cancellazione
stati. La card prenotazione è un evento nativo. URL/copia/telefono non devono
necessariamente produrre una risposta interattiva. Le azioni native dipendono
anche dal client del destinatario. Nessun invio incerto viene ritentato.

`node harness-check.mjs` nel container runtime verifica gli schemi dei 45 esempi,
la copertura delle 29 API e la UI desktop/mobile con backend simulato. Non usa
la sessione WhatsApp. `node smoke.mjs` verifica la pagina effettivamente servita
senza eseguire prove con effetti esterni. `node --test conversation.test.mjs` verifica il ponte PCM, i limiti delle code e il rifiuto dei retry.

La chiusura funzionale richiede conferme reali per lo scope accettato; l'aggiunta
delle schede e i test automatici non certificano tutte le API.

## Verifiche dell'implementazione

19 ottobre 2026: build dedicata riuscita, 61 test automatici superati (47 Node,
12 SDK, 2 core). Controllo schemi di tutte le 45 schede e Chromium desktop/mobile
superato nell'immagine finale, incluso accesso/rilascio di un microfono simulato.
Nessuna richiesta con effetti WhatsApp durante questi controlli. Smoke della
pagina servita superato, QR visibile, sessione in `pairing`. Restano da eseguire
le prove fisiche elencate nella matrice [premium](./PREMIUM-AUDIT.md).

## Correzione audio browser / telefono

Il primo collaudo umano ha confermato il collegamento della chiamata ma assenza
di audio in entrambe le direzioni. I precedenti test di superficie non coprivano
il driver audio nativo. Due cause individuate:

- Senza microfono fisico il driver WhatsApp sceglieva la cattura silenziosa,
  prima di richiedere lo stream iniettato tramite getUserMedia.
- La riproduzione VoIP usa driver Web Audio/WASM, non gli eventi track di
  RTCPeerConnection osservati dal provider precedente.

La patch ora integra selezione/acquisizione nativa del microfono virtuale,
osserva l'uscita del contesto di riproduzione nativo e sostituisce i media tramite
il metodo switchDevice del driver di cattura. Non presume un setInputStream
sullo stack VoIP. Il WAPI immutabile resta invariato.

La regressione sul percorso senza dispositivi è stata vista fallire e poi passare.
Una fixture isolata sui veri driver WhatsApp ha verificato stato Ready, segnale
PCM presente nell'ingresso e segnale intercettato in uscita. Il gate di
abilitazione è sostituito nella fixture: non è una chiamata di rete.
`node native-audio-check.mjs`, con browser WhatsApp disponibile e nessuna chiamata
attiva, ripete questa verifica senza chiamare destinatari. Resta obbligatoria
la conferma umana dell'audio PC ↔ telefono dopo l'attivazione del nuovo bundle.

## Snapshot iniziale vuoto e avvio dello stream

La successiva prova umana ha ancora rilevato zero pacchetti ricevuti e chiusura
del ponte. È stato riprodotto un secondo difetto, questa volta attraversando
SDK, CallingService, host Node e bridge reali: uno snapshot nativo inizialmente
vuoto chiudeva il media in attesa. La chiamata diventava poi attiva senza media.

Il core ora distingue uno snapshot iniziale vuoto dalla fine di una chiamata già
osservata o da uno snapshot terminale esplicito. `calling-stream.test.mjs` testa
entrambe le sequenze di avvio, segnale PCM in uscita, segnale ricevuto, continuità
dopo clearCallAudio e chiusura degli stream al vero hangup. Il provider nativo è
simulato in questo test; non è una prova di ascolto sul telefono. La regressione
è stata vista fallire sull'immagine precedente e passare dopo il fix.

La demo espone `phase`, `closedReason` e l'esito dell'ultima richiesta del ponte.
I campioni scartati prima della risposta possono dipendere dall'attesa dello
squillo: non sono da soli prova di perdita durante una conversazione attiva.
Build dedicata: 64 test superati (50 Node, 12 SDK, 2 core). L'audio PC ↔ telefono
resta da confermare in una nuova prova fisica dopo l'attivazione.

## Formato di ricezione a 16 kHz

Verificato anche il formato nativo con sample rate 16 kHz: un callback da 2048
campioni dura 128 ms e veniva respinto dal limite core di 120 ms. Il provider ora
suddivide il callback in frame di massimo 80 ms, mantenendo campioni, sequenza e
timeline. La regressione fallisce con il provider precedente e passa a 16/48 kHz.
La fixture nativa verifica anche l'ammissibilità di ciascun frame per il core.

Il bridge elimina dalla coda i pacchetti già riconosciuti dal browser: tali
pacchetti non vengono più conteggiati falsamente come persi al superamento
della finestra di mezzo secondo.

Le prove complete SDK/core/Node includono anche accettazione in ingresso,
mute/unmute con segnale effettivo nei frame, ricezione principale e osservatore,
arresto osservatore, sostituzione della sorgente, rilascio del vecchio stream,
chiusura e rifiuto senza allocazione di media. Il provider è simulato: la
conversazione PC ↔ telefono e l'intero IVR su WhatsApp restano da accettare.

## Risposte native e verifica isolata con CSP

Il listener ora preserva i parametri JSON nativi null, primitivi o array senza
accedere a campi da oggetto. La regressione verifica che una successiva risposta
quick_reply venga ancora elaborata. Il difetto era riproducibile con un payload
null, valido nello schema delle risposte native.

`native-audit.mjs` ora compila i sorgenti di sola lettura tramite CDP, evitando
new Function nella pagina, vietato dalla CSP WhatsApp. Il browser check verifica
una pagina con CSP restrittiva, rifiuto effettivo di unsafe-eval, esecuzione della
lettura isolata e conservazione dell'oggetto WAPI originale. Non vengono inviate
richieste WhatsApp in questa verifica con moduli simulati.

## Accettazione reale della conversazione — 20 ottobre 2026

L'utente conferma audio funzionante PC browser ↔ telefono in entrambe le
direzioni. Il registro SDK conferma chiamata uscente calling/ringing/active,
media attached e successivo ended. Questa prova accetta la conversazione
bidirezionale, non certifica i singoli controlli IVR, l'API endCall o la
stabilità di lunga durata. Le note precedenti descrivono le versioni storiche;
la conversazione non è più da considerare totalmente non verificata.
