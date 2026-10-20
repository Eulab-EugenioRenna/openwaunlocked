// Free local form workflow: native lists collect choices, then emit one response.
// There is one active workflow per chat and no automatic send retry.
const forms = new Map();
const formByChat = new Map();
const formChoice = message => {
  if (message.selectedButtonId) return message.selectedButtonId;
  if (message.listResponse?.singleSelectReply?.selectedRowId) return message.listResponse.singleSelectReply.selectedRowId;
  if (message.nativeFlowResponseMessage) {
    try { return JSON.parse(message.nativeFlowResponseMessage.paramsJson).id; } catch { return null; }
  }
  return null;
};
const removeForm = form => { forms.delete(form.token); if (formByChat.get(form.to) === form) formByChat.delete(form.to); };
const renderQuestion = async form => {
  const question = form.content.questions[form.index];
  const rows = question.options.map((option, index) => ({ id: `devform:${form.token}:${form.index}:option:${index}`,
    title: `${form.selected.has(option.id) ? '✓ ' : ''}${option.label}` }));
  if (question.allowCustomAnswer) rows.push({ id: `devform:${form.token}:${form.index}:custom`, title: 'Other answer' });
  if (question.type === 'multiSelect') rows.push({ id: `devform:${form.token}:${form.index}:submit`, title: 'Confirm choices' });
  const id = await api.sendInteractive(form.to, { type: 'list', title: form.content.title,
    body: `${form.content.body}\n\n${question.label}`, footer: form.content.footer,
    buttonLabel: question.type === 'multiSelect' ? 'Choose / confirm' : 'Choose an option', sections: [{ rows }] });
  form.rootId ??= id;
  form.lastId = id;
  return id;
};
dev.startForm = async (to, content) => {
  if (!Array.isArray(content.questions) || !content.questions.length) throw new Error('A form requires questions.');
  const chat = await dev.chat(to);
  const target = dev.serial(chat.id);
  if (formByChat.has(target)) throw new Error('This chat already has an active form. Complete it before starting another.');
  const form = { to: target, content, index: 0, token: crypto.randomUUID(), answers: Object.create(null), selected: new Set(),
    queue: Promise.resolve(), processed: new Set(), owner: null, awaitingCustom: false, rootId: null };
  forms.set(form.token, form); formByChat.set(target, form);
  form.queue = form.queue.then(() => renderQuestion(form));
  try { return await form.queue; } catch (error) { removeForm(form); throw error; }
};
const answerForm = async (form, message) => {
  if (!forms.has(form.token) || message.id?.fromMe) return;
  const chatId = dev.serial(message.id?.remote);
  const senderId = dev.serial(message.author ?? message.from);
  if (chatId !== form.to || (form.owner && form.owner !== senderId)) return;
  const responseId = dev.serial(message.id);
  if (form.processed.has(responseId)) return;
  const question = form.content.questions[form.index];
  const selected = formChoice(message);
  const prefix = `devform:${form.token}:${form.index}:`;
  if (form.awaitingCustom) {
    if (message.type !== 'chat' || typeof message.body !== 'string' || !message.body.trim()) return;
    form.awaitingCustom = false;
    if (question.type === 'multiSelect') form.selected.add(message.body);
    else form.answers[question.id] = message.body;
  } else {
    if (typeof selected !== 'string' || !selected.startsWith(prefix)) return;
    const choice = selected.slice(prefix.length);
    if (choice === 'custom' && question.allowCustomAnswer) {
      form.awaitingCustom = true; form.owner ??= senderId; form.processed.add(responseId);
      await api.sendMessage(form.to, `Reply with your answer: ${question.label}`);
      return;
    }
    if (choice.startsWith('option:')) {
      const index = Number(choice.slice(7));
      const option = Number.isInteger(index) ? question.options[index] : undefined;
      if (!option) return;
      if (question.type === 'multiSelect') {
        if (form.selected.has(option.id)) form.selected.delete(option.id); else form.selected.add(option.id);
      } else form.answers[question.id] = option.id;
    } else if (choice !== 'submit' || question.type !== 'multiSelect') return;
  }
  form.owner ??= senderId;
  form.processed.add(responseId);
  if (form.processed.size > 1024) throw new Error('The form interaction limit was reached.');
  if (question.type === 'multiSelect' && !selected?.endsWith(':submit')) { await renderQuestion(form); return; }
  if (question.type === 'multiSelect') form.answers[question.id] = [...form.selected];
  form.index++; form.selected.clear();
  if (form.index < form.content.questions.length) { await renderQuestion(form); return; }
  removeForm(form);
  dev.emitInteractiveResponse({ type: 'form', messageId: responseId, chatId, senderId,
    originalMessageId: form.rootId, timestamp: message.t, answers: form.answers, raw: dev.json(message) });
};
const onFormMessage = message => {
  if (message.id?.fromMe) return;
  const selection = formChoice(message);
  const token = typeof selection === 'string' && selection.startsWith('devform:') ? selection.split(':')[1] : null;
  const form = token ? forms.get(token) : formByChat.get(dev.serial(message.id?.remote));
  if (!form) return;
  form.queue = form.queue.then(() => answerForm(form, message)).catch(error => {
    removeForm(form);
    dev.emitInteractiveResponse({ type: 'native', name: 'local_form_error', messageId: dev.serial(message.id),
      chatId: form.to, senderId: dev.serial(message.author ?? message.from), originalMessageId: form.rootId,
      parameters: { error: error.message, outcome: 'unknown' }, raw: dev.json(message) });
  });
};
store.Msg.on('add', onFormMessage);
dev.cleanup.push(() => { store.Msg.off('add', onFormMessage); forms.clear(); formByChat.clear(); });

dev.sendBooking = async (to, content) => {
  if (typeof api.sendEvent !== 'function') throw new Error('The local native event patch is required for bookings.');
  const booking = content.booking;
  const description = [content.body, booking.description,
    booking.url && `Meeting: ${booking.url}`, booking.managementUrl && `${booking.labels?.manageBooking ?? 'Manage booking'}: ${booking.managementUrl}`,
    booking.phoneNumber && `Phone: ${booking.phoneNumber}`, booking.email && `Email: ${booking.email}`,
    ...(content.actions ?? []).map(item => `${item.label}: ${item.url ?? item.phoneNumber ?? item.code}`),
    content.footer].filter(Boolean).join('\n');
  const startTime = Math.floor(Date.parse(booking.startAt) / 1000);
  const endTime = booking.endAt ? Math.floor(Date.parse(booking.endAt) / 1000) : undefined;
  if (!Number.isFinite(startTime) || (endTime !== undefined && (!Number.isFinite(endTime) || endTime <= startTime))) throw new Error('Invalid booking times.');
  const result = await api.sendEvent(to, { name: content.title ?? content.buttonLabel ?? 'Booking', startTime,
    ...(endTime === undefined ? {} : { endTime }), location: booking.location, description });
  if (typeof result !== 'string' || !/^(true|false)_.+_.+$/.test(result)) throw new Error('The booking send result is uncertain; do not retry automatically.');
  return result;
};
