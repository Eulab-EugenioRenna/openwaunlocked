api.checkNumberStatus = async contactId => {
  const result = await dev.module('WAWebQueryExistsJob').queryWidExists(dev.wid(contactId));
  const jid = dev.serial(result?.wid);
  return { id: contactId, jid, status: jid ? 200 : 404, isBusiness: !!result?.biz, canReceiveMessage: !!jid, numberExists: !!jid };
};
api.getNumberProfile = async contactId => {
  const wid = dev.wid(contactId);
  const contact = await store.Contact.find(wid);
  if (!contact) throw new Error('The contact profile is unavailable.');
  const profile = await api._serializeContactObj(contact);
  if (!profile.profilePicThumbObj?.id) return profile;
  const thumbId = dev.wid(dev.serial(profile.profilePicThumbObj.id));
  return { ...profile, profilePicThumbObj: { ...profile.profilePicThumbObj,
    id: { user: thumbId.user, server: thumbId.server, _serialized: dev.serial(thumbId) } } };
};
api.getStarredMessages = async chatId => {
  const remote = chatId ? dev.serial((await dev.chat(chatId)).id) : null;
  return Promise.all(dev.models(store.Msg).filter(message => message.star && (!remote || dev.serial(message.id.remote) === remote))
    .map(dev.serializeMessage));
};
api.getOrder = async id => {
  const message = store.Msg.get(id) ?? dev.models(store.Msg).find(message => message.type === 'order' && message.orderId === id);
  if (!message || message.type !== 'order') throw new Error('An order message ID is required.');
  const order = await dev.module('WAWebBizOrderBridge').queryOrder({ sellerJid: message.sellerJid, orderId: message.orderId,
    height: 80, width: 80, token: message.token });
  const details = dev.json(order);
  if (!details || !Number.isFinite(details.createdAt) || typeof details.currency !== 'string' || details.subtotal == null || details.total == null || !Array.isArray(details.products)) throw new Error('WhatsApp returned incomplete order details.');
  const products = details.products.map(product => {
    if (typeof product.id !== 'string' || typeof product.name !== 'string' || !Number.isFinite(product.quantity)) throw new Error('WhatsApp returned an incomplete order product.');
    return { ...product, qty: product.quantity, thumbnailId: product.thumbnailId ?? '', thumbnailUrl: product.thumbnailUrl ?? '' };
  });
  return { ...details, id: message.orderId, sellerJid: dev.serial(message.sellerJid), products,
    subtotal: String(details.subtotal), total: String(details.total), message: await dev.serializeMessage(message) };
};
dev.serializeStatus = message => {
  const raw = dev.json(message), fromMe = message.id.fromMe === true;
  const text = raw.body ?? raw.caption ?? '';
  return { ...raw, id: dev.serial(message.id), body: text, content: text, type: message.type,
    t: message.t, timestamp: message.t, from: dev.serial(message.from ?? message.author), to: dev.serial(message.to ?? message.id.remote),
    self: fromMe ? 'out' : 'in', ack: message.ack, fromMe, chatId: dev.serial(message.id.remote),
    isGroupMsg: message.id.remote.isGroup(), isMedia: ['image', 'video', 'audio', 'ptt', 'document', 'sticker'].includes(message.type),
    isNotification: message.isNotification === true, isQuotedMsgAvailable: !!message.quotedStanzaID,
    author: dev.serial(message.author), senderId: dev.serial(message.author ?? message.from),
    mentionedJidList: raw.mentionedJidList?.map(dev.serial), caption: raw.caption ?? undefined, chat: null, sender: null };
};
api.getStories = () => dev.models(dev.module('WAWebCollections').Status)
  .flatMap(status => dev.models(status.msgs)).map(dev.serializeStatus);
api.getStatuses = api.getStories;
api.getStatus = async contactId => {
  const wid = dev.wid(contactId);
  const chat = store.Chat.get(wid);
  const result = await dev.module('WAWebContactStatusBridge').getStatus({ wid, tcToken: chat?.tcToken });
  if (result?.stale) throw new Error('WhatsApp could not confirm the contact status.');
  return { id: contactId, status: result?.status ?? '' };
};
const ownStatusMessages = () => dev.models(dev.module('WAWebCollections').Status)
  .flatMap(status => dev.models(status.msgs)).filter(message => message.id?.fromMe && dev.serial(message.id.remote) === 'status@broadcast');
api.getMyStatusArray = () => ownStatusMessages().map(dev.serializeStatus);
api.deleteStatus = async ids => {
  const statusStore = dev.module('WAWebCollections').Status;
  const owned = ownStatusMessages();
  const pending = [...new Set(Array.isArray(ids) ? ids : [ids])].map(id => {
    const message = owned.find(message => dev.serial(message.id) === id);
    if (!message) throw new Error('Only an existing status owned by this session can be deleted.');
    const ownStatus = statusStore.get(message.author ?? message.from);
    if (!ownStatus) throw new Error('The own-status collection is unavailable.');
    return { message, ownStatus };
  });
  if (!pending.length) return true;
  await dev.module('WAWebStatusDrawerFlowLoadable').StatusDrawerFlowLoadable.preload();
  for (const { message, ownStatus } of pending) {
    // Use native construction/encryption, but propagate rejection rather than the
    // UI action's swallowed error. Remove the local status only after the ack.
    const data = await dev.module('WAWebRevokeStatusAction').createRevokeStatusMsgData(message);
    const Msg = dev.module('WAWebMsgModel').Msg;
    const msg = new Msg(data);
    const metricsReporter = dev.module('WAWebSendMsgMetricReporter').createMsgModelMetricReporter(msg,
      dev.module('WAWebMessageSendReporterFrontendDeps').MAIN_WEB_MESSAGE_SEND_REPORTER_FRONTEND_DEPS);
    metricsReporter.sendReporter ??= metricsReporter.createSendReporter();
    const record = { type: dev.module('WAWebSendMsgTypes').SendMessageRecordType.Message, data: msg };
    const outgoing = dev.module('WAWebOutgoingMessage');
    const msgProtobuf = outgoing.createOutgoingMessageProtobuf(outgoing.OutgoingMessageOriginType.Status, record);
    await dev.module('WAWebEncryptAndSendStatusMsg').encryptAndSendStatusMsg({ metricsReporter, msgProtobuf, sendMsgRecord: record });
    ownStatus.revokeMsgs([dev.serial(message.id)]);
    await dev.module('WAWebDBMessageDelete').removeStatusMessage([message]);
  }
  return true;
};
api.deleteAllStatus = () => api.deleteStatus(ownStatusMessages().map(message => dev.serial(message.id)));
api.deleteAllStatuses = api.deleteAllStatus;
const statusSendId = result => {
  const id = dev.serial(result?.msg?.id);
  if (result?.messageSendResult !== 'OK' || !id) throw new Error(`WhatsApp did not confirm this status (${String(result?.messageSendResult)}); do not retry automatically.`);
  return id;
};
api.postTextStatus = async (text, textColor = '#FFFFFF', backgroundColor = '#3051D3', font = 0) => {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Status text cannot be empty.');
  if (!/^#?(?:[a-f0-9]{6}|[a-f0-9]{8})$/i.test(backgroundColor)) throw new Error('Invalid status background color.');
  if (!Number.isInteger(font) || font < 0 || font > 5) throw new Error('Invalid status font.');
  if (!/^#?F{6}(?:F{2})?$/i.test(textColor)) throw new Error('The native text status sender uses white text.');
  const color = Number.parseInt(backgroundColor.replace('#', '').padStart(8, 'F'), 16) >>> 0;
  const result = await dev.module('WAWebSendStatusMsgAction').sendStatusTextMsgAction({ text, color, font });
  return statusSendId(result);
};
const postMedia = async (type, source, caption) => {
  const { data } = await dev.prepareMedia({ type, source });
  const prefs = dev.module('WAWebUserPrefsMeUser');
  const to = dev.wid('status@broadcast');
  const author = dev.module('WAWebLidStatusMigrationUtils').matWidConvert(prefs.getMeUserOrThrow());
  const id = await dev.messageKey({ id: to }, author);
  const mediaMsgData = { ...data.toJSON(), id, from: prefs.getMeDeviceLidOrThrow(), to, author, caption: caption ?? '',
    t: Math.floor(Date.now() / 1000), type, isNewMsg: true, local: true, ack: 0 };
  const result = await dev.module('WAWebSendStatusMsgAction').sendStatusMediaMsgAction({ mediaMsgData, beforeSend: async () => undefined });
  return statusSendId(result);
};
api.postImageStatus = (source, caption) => postMedia('image', source, caption);
api.postVideoStatus = (source, caption) => postMedia('video', source, caption);
api.setProfilePic = async image => {
  if (!/^data:image\/(jpeg|png);base64,/.test(image)) throw new Error('Profile picture must be a PNG or JPEG data URL.');
  const blob = await (await fetch(image)).blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const render = size => {
      const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
      const side = Math.min(bitmap.width, bitmap.height);
      canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
      return canvas.toDataURL('image/jpeg', 0.9);
    };
    const me = dev.module('WAWebUserPrefsMeUser').getMaybeMePnUser();
    const result = await dev.module('WAWebContactProfilePicThumbBridge').sendSetPicture(me, render(96), render(640));
    if (result?.status !== 200) throw new Error('WhatsApp rejected the profile picture.');
    return true;
  } finally { bitmap.close(); }
};
api.setProfilePicture = api.setProfilePic;
api.createGroup = async (name, participants) => {
  await dev.module('WAWebNewGroupFlowLoadable').requireBundle();
  const members = (Array.isArray(participants) ? participants : [participants]).map(id => ({ phoneNumber: dev.wid(id) }));
  const result = await dev.module('WAWebGroupCreateJob').createGroup({ title: name,
    memberAddMode: false, membershipApprovalMode: false, announce: false, restrict: false, ephemeralDuration: 0 }, members);
  const gid = dev.serial(result?.wid);
  if (!gid?.endsWith('@g.us')) throw new Error('WhatsApp did not return a group ID; do not create the group again automatically.');
  return { ...dev.json(result), gid };
};
api.joinGroupViaLink = async (value, returnChatObj = false) => {
  const link = value.startsWith('https://') ? new URL(value) : null;
  if (link && link.hostname !== 'chat.whatsapp.com') throw new Error('Invalid group invite host.');
  const code = link ? link.pathname.slice(1) : value;
  if (!/^[A-Za-z0-9_-]+$/.test(code)) throw new Error('Invalid group invite code.');
  await dev.module('WAWebNewGroupFlowLoadable').requireBundle();
  const result = await dev.module('WAWebGroupInviteJob').joinGroupViaInvite(code, false);
  const id = dev.serial(result?.gid);
  if (!id?.endsWith('@g.us')) throw new Error('WhatsApp did not confirm joining the group.');
  return returnChatObj ? api._serializeChatObj(await dev.chat(id)) : id;
};
api.joinGroup = api.joinGroupViaLink;
// Use the native chat resolver for non-contact recipients as well.
api.sendMessage = async (to, text) => {
  const chat = await dev.chat(to);
  const result = await dev.module('WAWebSendTextMsgChatAction').sendTextMsgToChat(chat, text);
  const message = Array.isArray(result) ? await result[0] : result;
  const id = dev.serial(message?.id);
  if (!id || !id.includes('_')) throw new Error('WhatsApp did not return the sent message ID; do not retry automatically.');
  return id;
};
