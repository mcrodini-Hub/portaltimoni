// Ponte entre a página Compras do Portal Timoni e a extensão instalada.
// Não usa ID fixo da extensão: o próprio content script confirma presença e encaminha o clique.
(function () {
  const ORIGIN = 'https://portaltimoni.vercel.app';
  const CHANNEL = 'PORTAL_TIMONI_COMPRAS';

  if (location.origin !== ORIGIN) return;

  function notify(type, payload) {
    window.postMessage(
      {
        channel: CHANNEL,
        type,
        ...(payload || {})
      },
      ORIGIN
    );
  }

  function announceReady() {
    notify('READY', { version: chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version });
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== ORIGIN) return;
    if (event.data?.channel !== CHANNEL) return;

    if (event.data.type === 'PING') {
      announceReady();
      return;
    }

    if (event.data.type !== 'OPEN') return;

    chrome.runtime.sendMessage(
      { source: 'portal-timoni', action: 'OPEN_COMPRAS' },
      (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          notify('OPEN_RESULT', { success: false, error: runtimeError.message });
          return;
        }

        notify('OPEN_RESULT', {
          success: !!response?.success,
          error: response?.error || null
        });
      }
    );
  });

  announceReady();
  document.addEventListener('DOMContentLoaded', announceReady, { once: true });
})();
