# API audio per IVR e agente esterno

Branch `dev/free-use-offline`, 20 ottobre 2026. Il motore STT/TTS/LLM
resta un servizio esterno e non è installato qui.

## Contratto

`createVoiceCallAudio` è esportata da `@eulab/openwaunlocked-runtime-node`.

| Superficie | Uso |
| --- | --- |
| `media` | Passare a `call.accept`, `call.setMedia` o `client.startCall(to, media)` |
| `incoming` | Stream continuo della voce remota, PCM16LE mono a 16000 Hz |
| `write(bytes)` | Accodare PCM della risposta rispettando la capacità disponibile |
| `speak(stream)` | Consumare una risposta audio progressiva; un solo produttore per volta |
| `interrupt(call)` | Cancellare la risposta corrente, svuotare coda locale e output nativo |
| `close()` | Liberare gli stream; non termina la chiamata |
| `stats()` | Code, byte scartati in ricezione e byte rimossi durante interruzione |

`responseSampleRate` indica la frequenza del PCM prodotto dal motore esterno;
default 16000, valori interi 8000–192000 Hz. Il helper lo converte a 16000 Hz.
Per un motore che emette PCM a 24000 Hz usare `{ responseSampleRate: 24000 }`.
Entrambe le direzioni usano campioni signed 16 bit little-endian, un canale.
Rimuovere il contenitore WAV e decodificare MP3/Opus nel servizio esterno prima
di chiamare `write`/`speak`: questi metodi accettano soltanto PCM grezzo.

## Collegamento

Il seguente frammento presuppone un `client` già creato. `engine` rappresenta
il contratto dell'applicazione esterna:
`listen` consuma PCM, `responses` emette stream PCM e `cancelResponse` annulla
la generazione. L'adattatore al protocollo effettivo del modello resta esterno.

```ts
import { createVoiceCallAudio } from '@eulab/openwaunlocked-runtime-node';

await client.onIncomingCall(async call => {
  const audio = createVoiceCallAudio({ responseSampleRate: 24000 });
  const accepted = await call.accept(audio.media);
  if (!accepted.ok) {
    audio.close();
    return;
  }

  // Leggere e produrre audio in parallelo, nel servizio esterno.
  const listening = engine.listen(audio.incoming, audio.format);
  try {
    for await (const response of engine.responses()) {
      await audio.speak(response);
    }
  } finally {
    audio.close();
    await listening;
  }
});
```

L'engine deve chiudere il proprio ciclo `responses` quando lo stream in ingresso
finisce e propagare gli errori delle attività concorrenti. Il codice del suo
ciclo di vita dipende dal provider; il frammento illustra solo il collegamento
degli stream. Il trasporto è inizializzato con 20 ms di silenzio: accettare una
chiamata non richiede di aspettare la prima risposta del modello.

Per un'interruzione rilevata dal VAD/modello, il servizio esterno annulla la
generazione e chiama `await audio.interrupt(call)`, verificando `result.ok`.
La ricezione resta aperta. Una cancellazione mediante il solo `AbortSignal`
ferma la risposta e la coda locale, ma non invoca `call.clearAudio()`; usare
`interrupt` per svuotare anche l'output nativo. Se il clear fallisce, nuove
risposte sono bloccate fino a un successivo clear esplicito riuscito.
L'audio già riprodotto o in transito non può essere ritirato.

`speak` restituisce `completed` quando tutti i byte sono stati accodati oppure
`interrupted` quando la risposta è cancellata. `bytesQueued` conta byte PCM
normalizzati a 16000 Hz; non misura audio ascoltato né consegna confermata.

La coda di invio contiene al massimo 200 ms e applica backpressure. Quella di
ricezione contiene 500 ms e scarta l'audio più vecchio se il consumatore resta
indietro; controllare `incomingDroppedBytes`. Una pausa del modello lascia
la chiamata aperta, con silenzio in uscita e ascolto attivo. La chiusura media
da parte dell'SDK libera il helper. Per terminare esplicitamente usare
`call.end()`, controllarne il risultato e osservare lo stato terminale.

Restano disponibili `call.reject`, `mute`, `unmute`, `setMedia`, `observeAudio`
e `end`, con i relativi esiti e listener di stato. Non viene aggiunto un
riconoscitore DTMF: l'IVR vocale interpreta la voce nel servizio esterno.
Per un processo Node remoto usare `SocketClient` e i suoi stream applicativi;
un socket con protocollo proprietario richiede il proprio adattatore.

## Accettazione e capacità

La conversazione PC browser ↔ telefono è stata confermata dall'utente il
20 ottobre. Il helper e le interruzioni hanno prove automatiche con provider
nativo simulato; una conversazione con modello esterno non è stata eseguita.
Lo stato dettagliato delle altre API resta in [PREMIUM-AUDIT.md](./PREMIUM-AUDIT.md).

Questa API trasporta audio. L'estrazione dei fotogrammi delle videochiamate,
la pipeline verso un motore multimodale e la generazione di video per un
eventuale avatar richiedono componenti aggiuntivi.

Per 50 flussi simultanei servono gestione
multi-sessione e benchmark separati di GPU, memoria, latenza, durata e
interruzioni; non esiste qui una misura di capacità certificata. Anche
concorrenza e disponibilità delle sessioni WhatsApp vanno verificate a parte.
Il servizio chiamate conserva uno stato attivo per sessione: non rappresenta
50 chiamate indipendenti sulla stessa sessione WhatsApp.
