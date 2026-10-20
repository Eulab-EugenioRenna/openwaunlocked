const action = item => {
  const parameters = { display_text: item.label };
  switch (item.type) {
    case 'reply': return { name: 'quick_reply', buttonParamsJson: JSON.stringify({ ...parameters, id: item.id }) };
    case 'url': return { name: 'cta_url', buttonParamsJson: JSON.stringify({ ...parameters, url: item.url, merchant_url: item.url }) };
    case 'call': return { name: 'cta_call', buttonParamsJson: JSON.stringify({ ...parameters, phone_number: item.phoneNumber }) };
    case 'copy': return { name: 'cta_copy', buttonParamsJson: JSON.stringify({ ...parameters, copy_code: item.code }) };
    default: throw new Error(`Unknown interactive action: ${item.type}`);
  }
};
const nativeButton = (name, parameters) => ({ name, buttonParamsJson: JSON.stringify(parameters ?? {}) });
dev.interactive = async content => {
  const result = { body: { text: content.body }, footer: { text: content.footer ?? '' } };
  if (content.header) result.header = await dev.media(content.header);
  switch (content.type) {
    case 'buttons': result.nativeFlowMessage = { buttons: content.actions.map(action), messageVersion: 1 }; break;
    case 'native': result.nativeFlowMessage = { buttons: content.actions.map(item => nativeButton(item.name, item.parameters)), messageVersion: 1,
      ...(content.parameters ? { messageParamsJson: JSON.stringify(content.parameters) } : {}) }; break;
    case 'carousel': result.carouselMessage = { messageVersion: 1, cards: await Promise.all(content.cards.map(async card => ({
      body: { text: card.body }, header: await dev.media(card.header), nativeFlowMessage: { buttons: card.actions.map(action), messageVersion: 1 },
    }))) }; break;
    default: throw new Error(`Unknown interactive content: ${content.type}`);
  }
  return result;
};
api.sendRawMessage = async (to, payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Object.keys(payload).length) throw new Error('A protocol Message object is required.');
  if (payload.viewOnceMessage || payload.ephemeralMessage) throw new Error('Wrapped raw messages are not supported.');
  const interactive = payload.interactiveMessage;
  if (interactive && payload.listMessage) throw new Error('A message cannot contain both list and interactive content.');
  let fields = { type: 'chat', body: payload.extendedTextMessage?.text ?? payload.conversation ?? '' };
  if (interactive) {
    const nativeFlow = interactive.nativeFlowMessage;
    const carousel = interactive.carouselMessage;
    if ((!nativeFlow && !carousel) || (nativeFlow && carousel)) throw new Error('Exactly one native flow or carousel is required.');
    // The native parser enforces wire versions/capability gates and prepares media,
    // nativeFlowName, message kind and parsed carousel cards for the sender.
    const parse = dev.module('WAWebParseInteractiveMessageProto');
    const parsed = parse({ baseMessage: {}, messageProtobuf: dev.proto(payload), msgContext: 'send' });
    if (parsed?.msgData?.type !== 'interactive') throw new Error('WhatsApp cannot prepare this interactive payload: check messageVersion and native capabilities.');
    fields = { ...parsed.msgData, nativeFlowInteractiveMsg: !!nativeFlow };
  }
  if (payload.listMessage) {
    const parsed = dev.module('WAWebParseListMessageProto')({ baseMessage: {}, messageProtobuf: dev.proto(payload), msgContext: 'send' });
    if (parsed?.msgData?.type !== 'list') throw new Error('WhatsApp cannot prepare this list payload.');
    fields = parsed.msgData;
  }
  return dev.send(to, fields, payload);
};
api.sendInteractive = async (to, content) => {
  if (content.type === 'form') return dev.startForm(to, content);
  if (content.type === 'booking') return dev.sendBooking(to, content);
  if (content.type === 'list') return api.sendRawMessage(to, { listMessage: { title: content.title ?? '', description: content.body,
    footerText: content.footer ?? '', buttonText: content.buttonLabel ?? 'Choose an option', listType: 1,
    sections: content.sections.map(section => ({ title: section.title ?? '',
      rows: section.rows.map(row => ({ rowId: row.id, title: row.title, description: row.description ?? '' })) })) } });
  return api.sendRawMessage(to, { interactiveMessage: await dev.interactive(content) });
};
const normalizeButtons = buttons => buttons.map(item => {
  if (item.type) return item;
  if (item.url) return { type: 'url', label: item.text, url: item.url };
  if (item.phoneNumber) return { type: 'call', label: item.text, phoneNumber: item.phoneNumber };
  if (item.code) return { type: 'copy', label: item.text, code: item.code };
  return { type: 'reply', id: item.id, label: item.text };
});
api.sendButtons = (to, body, buttons, title, footer) => api.sendInteractive(to, { type: 'buttons', body,
  header: title ? { type: 'text', text: title } : undefined, footer, actions: normalizeButtons(buttons) });
api.sendAdvancedButtons = (to, body, buttons, text, footer, filename) => {
  const mime = /^data:([^;,]+)/.exec(body)?.[1];
  if (!mime) return api.sendButtons(to, text || body, buttons, undefined, footer);
  const type = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'document';
  return api.sendInteractive(to, { type: 'buttons', body: text, footer, header: { type, source: body, filename }, actions: normalizeButtons(buttons) });
};
api.sendListMessage = (to, sections, title, description, actionText) => api.sendInteractive(to, { type: 'list', body: description,
  title, buttonLabel: actionText, sections: sections.map(section => ({ ...section,
    rows: section.rows.map(row => ({ ...row, id: row.id ?? row.rowId })) })) });
api.sendList = api.sendListMessage;
dev.responseCallbacks = new Set();
dev.emitInteractiveResponse = response => {
  for (const callback of dev.responseCallbacks) Promise.resolve().then(() => callback(response)).catch(error => console.warn('Interactive response handler failed', error.message));
};
api.onInteractiveResponse = callback => {
  dev.responseCallbacks.add(callback);
  if (dev.responseListenerInstalled) return true;
  const emit = dev.emitInteractiveResponse;
  const listener = message => {
    if (message.id?.fromMe) return;
    const selection = message.selectedButtonId ?? message.listResponse?.singleSelectReply?.selectedRowId;
    if (typeof selection === 'string' && selection.startsWith('devform:')) return;
    const data = dev.json(message);
    const base = { messageId: dev.serial(message.id), chatId: dev.serial(message.id?.remote), senderId: dev.serial(message.author ?? message.from),
      timestamp: message.t, originalMessageId: dev.serial(message.quotedStanzaID), raw: data };
    if (message.selectedButtonId) emit({ ...base, type: 'reply', id: message.selectedButtonId, label: message.body });
    else if (message.listResponse?.singleSelectReply?.selectedRowId) emit({ ...base, type: 'list', id: message.listResponse.singleSelectReply.selectedRowId, label: message.body });
    else if (message.nativeFlowResponseMessage) {
      const response = message.nativeFlowResponseMessage;
      let parameters;
      try { parameters = JSON.parse(response.paramsJson); }
      catch (error) { emit({ ...base, type: 'native', name: response.name, parseError: error.message }); return; }
      // Native extensions may return any JSON value, including null. Only
      // object payloads can carry the selection fields below.
      if (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters)) {
        emit({ ...base, type: 'native', name: response.name, parameters });
        return;
      }
      if (typeof parameters.id === 'string' && parameters.id.startsWith('devform:')) return;
      if (response.name === 'quick_reply' && typeof parameters.id === 'string') emit({ ...base, type: 'reply', id: parameters.id, label: parameters.display_text });
      else if (response.name === 'single_select' && typeof parameters.id === 'string') emit({ ...base, type: 'list', id: parameters.id });
      else if (parameters.__openwa_form__ && parameters.answers) emit({ ...base, type: 'form', answers: parameters.answers });
      else emit({ ...base, type: 'native', name: response.name, parameters });
    }
  };
  store.Msg.on('add', listener);
  dev.responseListenerInstalled = true;
  dev.cleanup.push(() => store.Msg.off('add', listener));
  return true;
};
