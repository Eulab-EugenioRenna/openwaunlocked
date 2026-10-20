// Owned sources are compiled by CDP, outside the document's unsafe-eval policy.
// The API object is isolated; this inspection never replaces or sends through WAPI.
export function nativeInspectionSource(runtime, premium) {
  return `(async () => {
    const originalWindow = globalThis;
    const fake = { require: originalWindow.require, Store: originalWindow.Store, WAPI: {
      _serializeContactObj: originalWindow.WAPI._serializeContactObj,
      _serializeMessageObj: originalWindow.WAPI._serializeMessageObj
    } };
    const api = (() => {
      const window = fake;
      ${runtime}
      ${premium}
      return api;
    })();
    const me = String(originalWindow.require('WAWebUserPrefsMeUser').getMaybeMePnUser());
    const results = [];
    for (const [method, args] of [['checkNumberStatus',[me]], ['getNumberProfile',[me]], ['getStatus',[me]], ['getStories',[]], ['getStarredMessages',[me]]]) {
      try { results.push({ method, result: await api[method](...args) }); }
      catch (error) { results.push({ method, error: error.message }); }
    }
    return results;
  })()`;
}
