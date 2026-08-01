// Ponte entre a página Compras do Portal Timoni e a extensão instalada.
// A própria extensão anuncia presença, envia o resumo local e abre a lateral sob demanda.
(function () {
  const ORIGIN = 'https://portaltimoni.vercel.app';
  const CHANNEL = 'PORTAL_TIMONI_COMPRAS';
  const STORAGE_KEY = 'hubPedidosState';
  const BRIDGE_FLAG = '__portalTimoniComprasBridgeV112';

  if (location.origin !== ORIGIN) return;
  if (window[BRIDGE_FLAG]) return;
  window[BRIDGE_FLAG] = true;

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

  function getStoredState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(result?.[STORAGE_KEY] || null);
      });
    });
  }

  async function announceStatus(type = 'STATUS') {
    const manifest = chrome.runtime.getManifest();
    const state = await getStoredState();
    notify(type, {
      version: manifest.version_name || manifest.version,
      resumo: state?.resumoCompras || null,
      trelloScanned: !!state?.trelloScanned,
      currentState: state?.currentState || null,
      updatedAt: state?.resumoCompras?.atualizadoEm || state?.diagnostics?.lastUpdatedAt || null
    });
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== ORIGIN) return;
    if (event.data?.channel !== CHANNEL) return;

    if (event.data.type === 'PING' || event.data.type === 'GET_STATUS') {
      announceStatus('READY');
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

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_KEY]) return;
    announceStatus('STATUS');
  });

  announceStatus('READY');
  document.addEventListener('DOMContentLoaded', () => announceStatus('STATUS'), { once: true });
  window.addEventListener('pageshow', () => announceStatus('STATUS'));
})();
