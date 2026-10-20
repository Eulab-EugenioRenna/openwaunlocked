import type { Client } from '../Client';
import {
  implementMethod, getNumberProfile, getOrder, getStories, getStatus, deleteStatus, deleteAllStatus,
  getStarredMessages, setProfilePicture, sendButtons, sendAdvancedButtons, sendListMessage,
} from '@eulab/openwaunlocked-schema';
import { invokePatch } from '../patchRuntime';

export interface DevelopmentPremiumMethods {
  getNumberProfile: ReturnType<typeof implementMethod<typeof getNumberProfile>>;
  getOrder: ReturnType<typeof implementMethod<typeof getOrder>>;
  getStories: ReturnType<typeof implementMethod<typeof getStories>>;
  getStatuses: ReturnType<typeof implementMethod<typeof getStories>>;
  getStatus: ReturnType<typeof implementMethod<typeof getStatus>>;
  deleteStatus: ReturnType<typeof implementMethod<typeof deleteStatus>>;
  deleteAllStatus: ReturnType<typeof implementMethod<typeof deleteAllStatus>>;
  deleteAllStatuses: ReturnType<typeof implementMethod<typeof deleteAllStatus>>;
  getStarredMessages: ReturnType<typeof implementMethod<typeof getStarredMessages>>;
  setProfilePicture: ReturnType<typeof implementMethod<typeof setProfilePicture>>;
  setProfilePic: ReturnType<typeof implementMethod<typeof setProfilePicture>>;
  sendButtons: ReturnType<typeof implementMethod<typeof sendButtons>>;
  sendAdvancedButtons: ReturnType<typeof implementMethod<typeof sendAdvancedButtons>>;
  sendListMessage: ReturnType<typeof implementMethod<typeof sendListMessage>>;
  sendList: ReturnType<typeof implementMethod<typeof sendListMessage>>;
}

export function developmentPremiumMethods(client: Client): DevelopmentPremiumMethods {
  const methods = {
    getNumberProfile: implementMethod(getNumberProfile, async p => invokePatch(client, 'getNumberProfile', [p.contactId])),
    getOrder: implementMethod(getOrder, async p => invokePatch(client, 'getOrder', [p.id])),
    getStories: implementMethod(getStories, async () => invokePatch(client, 'getStories', [])),
    getStatus: implementMethod(getStatus, async p => invokePatch(client, 'getStatus', [p.contactId])),
    deleteStatus: implementMethod(deleteStatus, async p => invokePatch(client, 'deleteStatus', [p.statusesToDelete])),
    deleteAllStatus: implementMethod(deleteAllStatus, async () => invokePatch(client, 'deleteAllStatus', [])),
    getStarredMessages: implementMethod(getStarredMessages, async p => invokePatch(client, 'getStarredMessages', [p.chatId])),
    setProfilePicture: implementMethod(setProfilePicture, async p => invokePatch(client, 'setProfilePic', [p.image])),
    sendButtons: implementMethod(sendButtons, async p => invokePatch(client, 'sendButtons', [p.to, p.body, p.buttons, p.title, p.footer])),
    sendAdvancedButtons: implementMethod(sendAdvancedButtons, async p => invokePatch(client, 'sendAdvancedButtons', [p.to, p.body, p.buttons, p.text, p.footer, p.filename])),
    sendListMessage: implementMethod(sendListMessage, async p => invokePatch(client, 'sendListMessage', [p.to, p.sections, p.title, p.description, p.actionText])),
  };
  return { ...methods, getStatuses: methods.getStories, deleteAllStatuses: methods.deleteAllStatus,
    setProfilePic: methods.setProfilePicture, sendList: methods.sendListMessage };
}
