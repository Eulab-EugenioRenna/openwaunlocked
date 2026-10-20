import { installConversation } from './conversation-ui.mjs';
import { cases } from './cases.mjs';
const root = document.querySelector('#suite');
root.innerHTML = `<header><p class="eyebrow">COLLAUDO MANUALE / DEV</p><h2>Una prova, un risultato.</h2><p>Ogni scheda esegue una sola richiesta. HTTP riuscito significa richiesta eseguita: conferma l’effetto anche sul telefono.</p></header>
<div class="settings"><label>Immagine · URL o percorso server<input id="fixture-image"></label><label>Carica immagine dal computer<input id="image-file" type="file" accept="image/*"></label><label>Video · URL o percorso server<input id="fixture-video"></label><label>Documento · URL o percorso server<input id="fixture-document"></label><label>Audio · URL HTTP(S), vuoto = tono continuo<input id="fixture-audio" type="url"></label><label>URL azione / invito gruppo<input id="fixture-link" type="url"></label><label>Telefono azione con prefisso<input id="fixture-phone"></label><label>ID ordine<input id="fixture-order"></label><label>ID stato da cancellare<input id="fixture-status"></label></div>
<div id="conversation"></div><div class="call-panel"><h3>Controllo chiamata / IVR</h3><p>Per le prove audio viene trasmesso un tono continuo, oppure l’URL audio indicato sopra; il chiamante viene registrato. I percorsi file sono nel container. Per parlare usa il ponte microfono browser qui sotto; il tono verifica soltanto il trasporto.</p><button id="get-call">Aggiorna chiamata attiva</button><pre id="active-call">Nessuna identità caricata</pre><label>Identità chiamata · id, sessionId, generation<textarea id="call-identity" rows="3">null</textarea></label><label>ID osservatore<input id="observer-id"></label><p>Carica la chiamata dopo lo squillo, quindi prepara la scheda Accetta o Rifiuta. Nessuna risposta automatica.</p><p id="recording-path"></p><button id="load-recordings">Aggiorna registrazioni</button><div id="recordings"></div></div>
<nav id="test-nav" aria-label="Gruppi di test"></nav><div id="test-cases"></div>
<section><h3>Registro risposte e chiamate</h3><p>Eventi ricevuti dal consumer SDK: interactiveResponse, formResponse, incomingCall, callState. URL/copia/telefono possono non produrre risposte.</p><p id="event-status" role="status">In attesa del collegamento…</p><button id="clear-events">Pulisci vista</button><pre id="event-log" aria-live="polite"></pre></section>
<section><h3>Accettazione dello scenario IVR</h3><p>Queste prove richiedono due telefoni. La conferma resta manuale.</p><div id="ivr-checks"></div><label>Note sul collaudo<textarea id="acceptance-notes" rows="3"></textarea></label><button id="export-report">Esporta report del collaudo</button><p>Le conferme sono conservate solo nella pagina corrente. Esporta prima di chiuderla.</p></section>`;
const $ = id => document.getElementById(id);
let active = null, observerId = '', cursor = 0, polling = false, ready = false, running = false;
let recording = `/state/demo-received-${Date.now()}.wav`;
const results = new Map();
function context() {
  try { active = JSON.parse($('call-identity').value); } catch { active = null; }
  const raw = $('recipient').value.trim();
  return {to:raw.includes('@')?raw:raw.replace(/\D/g,'')+'@c.us',image:$('fixture-image').value.trim(),video:$('fixture-video').value.trim(),document:$('fixture-document').value.trim(),audio:$('fixture-audio').value.trim(),recording,call:active,observerId:$('observer-id').value.trim(),phone:$('fixture-phone').value.trim(),link:$('fixture-link').value.trim(),orderId:$('fixture-order').value.trim(),statusId:$('fixture-status').value.trim()};
}
function missing(value, key = '') { return value === null ? !['microphone','speaker','camera'].includes(key) : value === '' || Array.isArray(value) && value.some(item=>missing(item)) || value && typeof value === 'object' && Object.entries(value).some(([name,item])=>missing(item,name)); }
async function request(method, params) {
  const response = await fetch('/api/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params)});
  const value = await response.json();
  return { response, value };
}
const checklist = ['Chiamata in ingresso visibile con identità corretta','Accettazione: collegamento e audio effettivi','Rifiuto: il chiamante vede la chiamata rifiutata','Conversazione: entrambi parlano e si sentono contemporaneamente','Stream ricevuto: registrazione contiene la voce del chiamante','Stream trasmesso: tono o voce ricevuti senza interruzioni anomale','Barge-in: clearCallAudio interrompe l’uscita mentre la ricezione continua','Mute/unmute: cambia la trasmissione, continua la ricezione','Cambio sorgente: setCallMedia mantiene la chiamata','Osservatore: avvio/arresto senza interrompere la conversazione','IVR: saluto → ascolto → risposta → interruzione → nuovo ascolto','Stabilità: almeno 5 minuti, silenzi e ripresa dello stream','Chiusura da entrambi i lati e nuova chiamata senza risorse residue'];
checklist.forEach((label,index)=>{const row=document.createElement('label');row.className='check-row';const select=document.createElement('select');select.id='ivr-'+index;for(const text of ['Da verificare','Confermato','Fallito'])select.add(new Option(text,text));row.append(document.createTextNode(label),select);$('ivr-checks').append(row)});
$('image-file').onchange=async()=>{const file=$('image-file').files[0];if(!file)return;if(file.size>8_000_000){alert('Usa un’immagine inferiore a 8 MB.');return}const reader=new FileReader();reader.onload=()=>{$('fixture-image').value=reader.result};reader.readAsDataURL(file)};
const definitions = cases(context());
for (const group of [...new Set(definitions.map(item=>item.group))]) {
  const section=document.createElement('section');section.id='group-'+group.replaceAll(' ','-');
  const heading=document.createElement('h3');heading.textContent=group;section.append(heading);
  const nav=document.createElement('a');nav.href='#'+section.id;nav.textContent=group;$('test-nav').append(nav);
  for(const item of definitions.filter(item=>item.group===group)) {
    const article=document.createElement('article');article.className='test-case';article.dataset.case=item.id;
    const title=document.createElement('h4');title.textContent=item.title;
    const method=document.createElement('code');method.textContent=item.method;
    const check=document.createElement('p');check.textContent=item.check;
    const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Parametri della prova';
    const textarea=document.createElement('textarea');textarea.setAttribute('aria-label','Parametri '+item.title);textarea.value=JSON.stringify(item.params,null,2);details.append(summary,textarea);
    const prepare=document.createElement('button');prepare.className='secondary';prepare.textContent='Prepara con i dati attuali';
    const run=document.createElement('button');run.textContent='Esegui una volta';run.dataset.execute='true';
    const status=document.createElement('p');status.className='test-status';status.textContent='Non eseguito';status.setAttribute('role','status');
    const output=document.createElement('pre');
    const verdict=document.createElement('select');verdict.setAttribute('aria-label','Esito fisico '+item.title);for(const value of ['Effetto fisico da verificare','Confermato sul telefono','Fallito sul telefono'])verdict.add(new Option(value,value));
    const validate=()=>{try{const value=JSON.parse(textarea.value);run.disabled=!ready||running||missing(value)||JSON.stringify(value).includes('"@c.us"')}catch{run.disabled=true}};
    prepare.onclick=()=>{const current=cases(context()).find(entry=>entry.id===item.id);textarea.value=JSON.stringify(current.params,null,2);details.open=true;validate()};
    textarea.oninput=validate;
    verdict.onchange=()=>{results.set(item.id,{...results.get(item.id),title:item.title,method:item.method,physical:verdict.value})};
    run.onclick=async()=>{
      if(run.disabled||running)return;
      running=true;document.querySelectorAll('[data-execute]').forEach(button=>button.disabled=true);run.disabled=true;
      status.textContent='Richiesta in corso…';
      verdict.value='Effetto fisico da verificare';
      try {
        const {response,value}=await request(item.method,JSON.parse(textarea.value));
        const failed=!response.ok||value.ok===false||value.result===false||value.result?.ok===false;
        status.textContent=failed?'Richiesta fallita · verifica il dettaglio':'Richiesta completata · effetto fisico da verificare';
        output.textContent=JSON.stringify(value,null,2);
        results.set(item.id,{title:item.title,method:item.method,at:new Date().toISOString(),request:failed?'failed':'completed',physical:verdict.value,result:value});
        if(item.method==='getActiveCall')setCall(value.result);
        if(value.result?.observerId){observerId=value.result.observerId;$('observer-id').value=observerId}
        if(['startCall','acceptCall','setCallMedia','observeCallAudio'].includes(item.method)){recording=`/state/demo-received-${Date.now()}.wav`;$('recording-path').textContent='Prossimo file: '+recording}
      }catch(error){status.textContent='Esito incerto · nessun retry automatico';output.textContent=error.message;results.set(item.id,{title:item.title,method:item.method,request:'unknown',error:error.message})}
      finally{running=false;window.dispatchEvent(new Event('demo-validation'))}
    };
    window.addEventListener('demo-validation',validate);
    article.append(title,method,check,prepare,details,run,status,verdict,output);section.append(article);validate();
  }
  $('test-cases').append(section);
}
function setCall(value){$('active-call').textContent=JSON.stringify(value,null,2);if(!value){active=null;$('call-identity').value='null'}if(value?.id){active={id:value.id,sessionId:value.sessionId,generation:value.generation};$('call-identity').value=JSON.stringify(active,null,2)}}
$('get-call').onclick=async()=>{try{const {response,value}=await request('getActiveCall',{});if(!response.ok||!value.ok)throw Error(value.error||'Lettura fallita');setCall(value.result)}catch(error){$('active-call').textContent=error.message}};
$('load-recordings').onclick=async()=>{try{const response=await fetch('/recordings');if(!response.ok)throw Error('Registrazioni non disponibili');const names=await response.json();$('recordings').replaceChildren();for(const name of names){const row=document.createElement('div'),a=document.createElement('a');a.href='/recordings/'+name;a.download=name;a.textContent=name;const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.src=a.href;const inspect=document.createElement('button');inspect.textContent='Verifica stream registrato';const metrics=document.createElement('pre');inspect.onclick=async()=>{try{const r=await fetch('/recording-info/'+name);metrics.textContent=JSON.stringify(await r.json(),null,2)}catch(error){metrics.textContent=error.message}};row.append(a,audio,inspect,metrics);$('recordings').append(row)}if(!names.length)$('recordings').textContent='Nessuna registrazione. Termina la chiamata o l’osservatore per finalizzare il file.'}catch(error){$('recordings').textContent=error.message}};
$('clear-events').onclick=()=>{$('event-log').textContent=''};
$('export-report').onclick=()=>{const report={at:new Date().toISOString(),tests:definitions.map(item=>results.get(item.id)||{title:item.title,method:item.method,request:'not-run',physical:'Effetto fisico da verificare'}),browserBridge:{status:$('voice-status')?.textContent,metrics:$('voice-metrics')?.textContent},ivr:checklist.map((test,index)=>({test,result:$('ivr-'+index).value})),notes:$('acceptance-notes').value};const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='openwa-collaudo.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('recording-path').textContent='Prossimo file: '+recording;
async function poll(){if(polling)return;polling=true;try{const health=await(await fetch('/health')).json();ready=health.state==='ready';window.dispatchEvent(new Event('demo-validation'));const response=await fetch('/events?after='+cursor);if(!response.ok)throw Error('Registro eventi non disponibile in questa versione del server');const value=await response.json();if(value.cursor<cursor){cursor=0;return}cursor=value.cursor;for(const event of value.events){if(['incomingCall','callState'].includes(event.type))setCall(event.data);$('event-log').textContent=(JSON.stringify(event,null,2)+'\n'+$('event-log').textContent).slice(0,60000)}$('event-status').textContent=(ready?'SDK collegato':'Sessione '+health.state)+(value.truncated?' · registro precedente parzialmente scaduto':'')}catch(error){$('event-status').textContent=error.message}finally{polling=false}}
poll();setInterval(poll,2000);

installConversation({context,request,setCall});
