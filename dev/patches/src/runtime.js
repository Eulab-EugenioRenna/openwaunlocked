// Local development runtime. Never downloads code or resolves a license key.
const dev = { cleanup: [] };
const api = window.WAPI;
if (!api || !window.Store) throw new Error('The WhatsApp runtime must be installed first.');
const store = window.Store;
const modules = new Map();
dev.module = (name) => {
  if (modules.has(name)) return modules.get(name);
  const value = window.require(name);
  if (value === undefined || value === null) throw new Error(`WhatsApp module ${name} is unavailable in this runtime.`);
  modules.set(name, value);
  return value;
};
dev.exportOwner = (name) => {
  const registered = dev.module('__debug').modulesMap;
  for (const [id, entry] of Object.entries(registered)) {
    if (!id.startsWith('WAWeb') || !entry?.exports) continue;
    const owner = entry.exports;
    if (Object.hasOwn(owner, name)) return owner;
  }
  throw new Error(`WhatsApp export ${name} is unavailable in this runtime.`);
};
dev.fn = name => {
  const owner = dev.exportOwner(name);
  if (typeof owner[name] !== 'function') throw new Error(`WhatsApp export ${name} is not callable.`);
  return owner[name].bind(owner);
};
dev.wid = value => dev.module('WAWebWidFactory').createWid(value);
dev.me = chat => {
  const prefs = dev.module('WAWebUserPrefsMeUser');
  const useLid = chat.id.isLid() || (chat.id.isGroup() && chat.groupMetadata?.isLidAddressingMode);
  return useLid ? prefs.getMaybeMeLidUser() : prefs.getMaybeMePnUser();
};
dev.serial = value => typeof value === 'string' ? value : value?._serialized ?? value?.toString();
dev.json = model => typeof model?.toJSON === 'function' ? model.toJSON() : model;
dev.models = collection => collection.getModelsArray();
dev.chat = async to => {
  if (typeof to !== 'string' || !/^[^@\s]+@(c\.us|lid|g\.us|broadcast)$/.test(to)) throw new Error('Invalid chat ID.');
  if (to === 'status@broadcast') {
    const Chat = dev.module('WAWebChatModel').Chat;
    return new Chat({ id: dev.wid(to) });
  }
  const wid = dev.wid(to);
  const chat = store.Chat.get(wid) ?? (await dev.module('WAWebFindChatAction').findOrCreateLatestChat(wid))?.chat;
  if (!chat) throw new Error(`WhatsApp could not resolve chat ${to}.`);
  return chat;
};
dev.messageKey = async (chat, from) => {
  const MsgKey = dev.module('WAWebMsgKey');
  const participant = chat.id.isGroup() || dev.serial(chat.id) === 'status@broadcast' ? from : undefined;
  return new MsgKey({ from, to: chat.id, id: await MsgKey.newId(), participant, selfDir: 'out' });
};
const rawPayloads = new Map();
let encoderInstalled = false;
dev.installEncoder = () => {
  if (encoderInstalled) return;
  const owner = dev.module('WAWebMessagePluginGenerateProtobuf');
  const original = owner.generateProtobuf;
  if (typeof original !== 'function') throw new Error('WhatsApp generateProtobuf is unavailable.');
  const replacement = function(input, ...args) {
    const payload = rawPayloads.get(dev.serial(input.json?.id));
    return payload ?? Reflect.apply(original, this, [input, ...args]);
  };
  owner.generateProtobuf = replacement;
  dev.cleanup.push(() => {
    if (owner.generateProtobuf === replacement) owner.generateProtobuf = original;
    rawPayloads.clear();
  });
  encoderInstalled = true;
};
const byteFields = new Set(['fileSha256', 'fileEncSha256', 'mediaKey', 'jpegThumbnail', 'thumbnailSha256', 'thumbnailEncSha256', 'messageSecret']);
dev.proto = value => {
  if (Array.isArray(value)) return value.map(dev.proto);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    byteFields.has(key) && typeof item === 'string' ? Uint8Array.from(atob(item), c => c.charCodeAt(0)) : dev.proto(item)]));
};
dev.send = async (to, fields, proto) => {
  const chat = await dev.chat(to);
  const from = dev.me(chat);
  if (!from) throw new Error('The authenticated sender identity is unavailable.');
  const id = await dev.messageKey(chat, from);
  const serialized = dev.serial(id);
  const message = { ...dev.module('WAWebGetEphemeralFieldsMsgActionsUtils').getEphemeralFields(chat), ...fields,
    id, from, to: chat.id, t: Math.floor(Date.now() / 1000), self: 'out', local: true, isNewMsg: true, ack: 0 };
  if (to === 'status@broadcast') message.author = from;
  if (proto) {
    dev.installEncoder();
    // Keep exact payloads for native in-document retries; never retry a send here.
    if (rawPayloads.size >= 512) throw new Error('Local raw-message capacity reached; refresh before sending more raw messages.');
    rawPayloads.set(serialized, dev.proto(proto));
  }
  const result = await dev.module('WAWebSendMsgChatAction').addAndSendMsgToChat(chat, message);
  if (!Array.isArray(result) || result.length < 2) throw new Error('The WhatsApp send result could not be confirmed; do not retry automatically.');
  const [sentMessage, confirmation] = await Promise.all(result);
  const outcome = confirmation?.messageSendResult ?? confirmation;
  if (outcome !== 'OK' || dev.serial(sentMessage?.id) !== serialized) {
    throw new Error(`WhatsApp did not confirm this send (${String(outcome)}); do not retry automatically.`);
  }
  return serialized;
};
dev.prepareMedia = async header => {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(header.source);
  if (!match) throw new Error('Media must be resolved to a base64 data URL before reaching the browser.');
  const file = new File([Uint8Array.from(atob(match[2]), char => char.charCodeAt(0))], header.filename ?? 'attachment', { type: match[1] });
  const OpaqueData = dev.module('WAWebMediaOpaqueData');
  const opaque = await OpaqueData.createFromData(file, file.type);
  const prep = dev.module('WAWebPrepRawMedia').prepRawMedia(opaque, { asDocument: header.type === 'document' });
  const data = await prep.waitForPrep();
  if (!data?.filehash) throw new Error('WhatsApp did not prepare the media.');
  const mediaObject = dev.module('WAWebMediaStorage').getOrCreateMediaObject(data.filehash);
  if (!(data.mediaBlob instanceof OpaqueData)) data.mediaBlob = await OpaqueData.createFromData(data.mediaBlob, data.mediaBlob.type);
  data.renderableUrl = data.mediaBlob.url();
  mediaObject.consolidate(data.toJSON());
  const mediaType = dev.module('WAWebMmsMediaTypes').msgToMediaType({ type: data.type, isGif: data.isGif, isNewsletter: false });
  let uploaded;
  try { uploaded = await dev.module('WAWebMediaMmsV4Upload').uploadMedia({ mimetype: data.mimetype, mediaObject, mediaType }); }
  finally { data.mediaBlob.autorelease(); }
  if (!uploaded?.mediaEntry) throw new Error('WhatsApp did not confirm the media upload.');
  const entry = uploaded.mediaEntry;
  data.set({ clientUrl: entry.mmsUrl, deprecatedMms3Url: entry.deprecatedMms3Url, directPath: entry.directPath,
    mediaKey: entry.mediaKey, mediaKeyTimestamp: entry.mediaKeyTimestamp, encFilehash: entry.encFilehash,
    uploadhash: entry.uploadHash, size: mediaObject.size, streamingSidecar: entry.sidecar, firstFrameSidecar: entry.firstFrameSidecar });
  const proto = { url: entry.mmsUrl, directPath: entry.directPath, mediaKey: entry.mediaKey,
    fileEncSha256: entry.encFilehash, fileSha256: data.filehash, fileLength: data.size,
    mimetype: data.mimetype, width: data.fullWidth, height: data.fullHeight, seconds: data.duration == null ? undefined : Number.parseInt(data.duration, 10),
    fileName: header.filename, jpegThumbnail: data.preview };
  return { data, header: { title: header.title ?? '', hasMediaAttachment: true, [`${header.type}Message`]: proto } };
};
dev.media = async header => {
  if (!header || header.type === 'text') return { title: header?.text ?? '', hasMediaAttachment: false };
  return (await dev.prepareMedia(header)).header;
};
dev.serializeMessage = message => api._serializeMessageObj(message);
