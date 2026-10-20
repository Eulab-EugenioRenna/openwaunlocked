// Each case performs one API request, only after an explicit click.
export function cases({ to, image, video, document, audio, recording, call, observerId, phone, link, orderId, statusId }) {
  const body = 'Collaudo OpenWA dev';
  const replies = [{ type: 'reply', id: 'test_confirm', label: 'Conferma' }, { type: 'reply', id: 'test_cancel', label: 'Annulla' }];
  const sections = [{ title: 'Servizi', rows: [{ id: 'info', title: 'Informazioni' }, { id: 'booking', title: 'Appuntamento' }] }];
  const microphone = audio ? { kind: 'url', url: audio } : { kind: 'file', path: '/state/demo-tone.wav', loop: true };
  const speaker = { kind: 'file', path: recording };
  const interactive = (id, title, content, check) => ({ id, group: 'Interattivi', title, method: 'sendInteractive', params: { to, content: { body, ...content } }, check });
  const api = (id, group, title, method, params, check) => ({ id, group, title, method, params, check });
  return [
    interactive('reply', 'Due pulsanti reply', { type: 'buttons', actions: replies }, 'Ricezione, due pulsanti separati e clic. Verifica ID e originalMessageId nel registro.'),
    ...['image', 'video', 'document'].map(type => interactive('header-'+type, 'Pulsanti con '+type, { type: 'buttons', header: { type, source: ({ image, video, document })[type] || null, filename: 'test.'+({image:'png',video:'mp4',document:'pdf'})[type] }, actions: replies }, 'Media visibile/apribile e risposta al pulsante nel registro.')),
    interactive('url', 'Pulsante URL', { type: 'buttons', actions: [{ type: 'url', label: 'Apri sito', url: link || null }] }, 'Il destinatario apre il sito. Un clic URL può non generare una risposta WhatsApp.'),
    interactive('call-action', 'Pulsante telefono', { type: 'buttons', actions: [{ type: 'call', label: 'Chiama', phoneNumber: phone || null }] }, 'Verifica apertura del dialer sul telefono destinatario.'),
    interactive('copy', 'Pulsante copia', { type: 'buttons', actions: [{ type: 'copy', label: 'Copia codice', code: 'OPENWA-DEV' }] }, 'Verifica copia del codice sul telefono destinatario.'),
    interactive('list', 'Lista interattiva', { type: 'list', buttonLabel: 'Scegli servizio', sections }, 'Apri lista, scegli una voce e verifica ID nel registro.'),
    interactive('carousel', 'Carosello con due schede', { type: 'carousel', cards: [1,2].map(n => ({ body: 'Scheda '+n, header: { type: 'image', source: image || null }, actions: [{ type: 'reply', id: 'card_'+n, label: 'Scegli '+n }] })) }, 'Scorri entrambe le schede, controlla immagini e clic di ciascuna scheda.'),
    interactive('form-single', 'Form a due domande', { type: 'form', title: 'Richiesta informazioni', questions: [1,2].map(n => ({ type: 'singleSelect', id: 'question_'+n, label: 'Domanda '+n, options: [{ id: 'yes', label: 'Sì' }, { id: 'no', label: 'No' }] })) }, 'Completa tutte le domande. Attendi formResponse con entrambe le risposte.'),
    interactive('form-multi', 'Form multiplo e risposta libera', { type: 'form', questions: [{ type: 'multiSelect', id: 'services', label: 'Quali servizi?', allowCustomAnswer: true, options: [{ id: 'a', label: 'Servizio A' }, { id: 'b', label: 'Servizio B' }] }] }, 'Prova selezione multipla, completamento e risposta personalizzata. Verifica answers.'),
    interactive('booking', 'Prenotazione / evento', { type: 'booking', title: 'Appuntamento di prova', booking: { startAt: new Date(Date.now()+86400000).toISOString(), endAt: new Date(Date.now()+90000000).toISOString(), location: 'Collaudo', description: 'Evento di prova' } }, 'Verifica evento, data e risposta. Implementato come evento nativo, non card proprietaria.'),
    interactive('native', 'Azione nativa URL', { type: 'native', actions: [{ name: 'cta_url', parameters: { display_text: 'Apri sito', url: link || null } }] }, 'Verifica rendering e apertura URL. Supporto dipendente dal client WhatsApp.'),
    api('buttons','API pulsanti','sendButtons · due reply','sendButtons',{to,body,buttons:[{id:'api_yes',text:'Conferma'},{id:'api_no',text:'Annulla'}]},'Controlla due pulsanti cliccabili e relative risposte.'),
    api('advanced','API pulsanti','sendAdvancedButtons · immagine','sendAdvancedButtons',{to,body:/^data:image\//.test(image||'')?image:null,buttons:[{id:'advanced_yes',text:'Conferma'}],text:body,footer:'Test sviluppo',filename:'test.png'},'Carica una immagine dal selettore file (data URL), poi controlla immagine, testo e clic.'),
    api('list-api','API pulsanti','sendListMessage','sendListMessage',{to,sections,title:'Servizi',description:body,actionText:'Scegli'},'Apri lista e verifica risposta nel registro.'),
    api('raw','API pulsanti','sendRawMessage · testo','sendRawMessage',{to,payload:{conversation:body}},'Controlla ricezione del testo. Non certifica payload raw arbitrari.'),
    api('capabilities','Chiamate','Disponibilità chiamate','getCallCapabilities',{},'Metadati di disponibilità, non prova audio.'),
    api('active','Chiamate','Leggi chiamata attiva','getActiveCall',{},'Durante squillo e conversazione verifica stato, direzione e identità.'),
    api('start','Chiamate','Avvia · trasmetti e registra','startCall',{to,microphone,speaker},'Rispondi dal secondo telefono: senti il tono/audio e parla. Poi termina e scarica la registrazione.'),
    api('accept','Chiamate','Accetta · trasmetti e registra','acceptCall',{call,media:{microphone,speaker}},'Chiama questo account da un altro telefono, aggiorna identità e accetta. Verifica entrambe le direzioni.'),
    ...[['reject','Rifiuta','rejectCall'],['end','Termina','endCall'],['clear','Interrompi audio in uscita','clearCallAudio']].map(([id,title,method])=>api(id,'Chiamate',title,method,{call},'Verifica sul secondo telefono l’effetto reale e lo stato nel registro.')),
    ...[true,false].map(muted=>api(muted?'mute':'unmute','Chiamate',muted?'Disattiva microfono':'Riattiva microfono','muteCall',{call,muted},'Verifica che cambi soltanto la trasmissione; la ricezione deve continuare.')),
    api('media','Chiamate','Sostituisci media','setCallMedia',{call,media:{microphone,speaker}},'Verifica cambio sorgente senza chiusura della chiamata.'),
    api('listen-only','Chiamate','IVR · solo ascolto','setCallMedia',{call,media:{microphone:null,speaker}},'Dopo il saluto, verifica che la trasmissione sia silenziosa e il chiamante venga ancora registrato.'),
    api('transmit-only','Chiamate','IVR · solo riproduzione','setCallMedia',{call,media:{microphone,speaker:null}},'Verifica riproduzione senza ricezione sul media principale; un osservatore separato può continuare a registrare.'),
    api('observe','Chiamate','Registra con osservatore','observeCallAudio',{call,speaker},'Parla dal secondo telefono. Controlla observerId e audio registrato senza interrompere la sorgente.'),
    api('stop-observe','Chiamate','Arresta osservatore','stopCallAudioObserver',{call,observerId:observerId||null},'Verifica chiusura della registrazione con chiamata ancora attiva.'),
    ...[['number','Numero','checkNumberStatus',{contactId:to}],['profile','Profilo','getNumberProfile',{contactId:to}],['status','Info contatto','getStatus',{contactId:to}],['stories','Leggi stati','getStories',{}],['starred','Preferiti','getStarredMessages',{chatId:to}],['order','Ordine reale','getOrder',{id:orderId||null}]].map(([id,title,method,params])=>api(id,'Altre API',title,method,params,'Verifica i dati rispetto a WhatsApp; per i preferiti serve almeno un messaggio marcato.')),
    api('text-status','Altre API','Pubblica stato testo','postTextStatus',{text:body},'Controlla dal secondo account la visibilità dello stato.'),
    api('image-status','Altre API','Pubblica stato immagine','postImageStatus',{image:image||null,caption:body},'Controlla immagine e didascalia dal secondo account.'),
    api('video-status','Altre API','Pubblica stato video','postVideoStatus',{video:video||null,caption:body},'Controlla riproduzione audio/video dal secondo account.'),
    api('delete-status','Altre API','Cancella stato di prova','deleteStatus',{statusesToDelete:statusId?[statusId]:null},'Usa soltanto ID dello stato creato per il test; controlla la scomparsa.'),
    api('delete-all','Altre API','Cancella tutti gli stati propri','deleteAllStatus',{},'Solo su account di collaudo: elimina tutti gli stati propri.'),
    api('picture','Altre API','Modifica foto profilo','setProfilePicture',{image:image||null},'Solo su account di collaudo: verifica la nuova foto.'),
    api('create-group','Altre API','Crea gruppo di prova','createGroup',{name:'Collaudo OpenWA',contacts:[to]},'Controlla creazione e partecipante sul secondo account.'),
    api('join-group','Altre API','Entra con invito','joinGroupViaLink',{link:link||null,returnChatObj:true},'Inserisci un invito dedicato; verifica ingresso e oggetto chat restituito.'),
  ];
}
