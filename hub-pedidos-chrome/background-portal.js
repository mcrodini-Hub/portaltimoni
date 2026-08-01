// Service worker principal da extensão Compras.
// Carrega o fluxo existente e acrescenta somente a ponte segura com o Portal Timoni.
importScripts('background.js');

const PORTAL_TIMONI_ORIGIN = 'https://portaltimoni.vercel.app';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.source !== 'portal-timoni' || message?.action !== 'OPEN_COMPRAS') {
    return false;
  }

  const senderUrl = sender.tab?.url || sender.url || '';
  if (!senderUrl.startsWith(`${PORTAL_TIMONI_ORIGIN}/`)) {
    sendResponse({ success: false, error: 'Origem não autorizada.' });
    return false;
  }

  const windowId = sender.tab?.windowId;
  if (!Number.isInteger(windowId)) {
    sendResponse({ success: false, error: 'Janela do Chrome não identificada.' });
    return false;
  }

  chrome.sidePanel
    .open({ windowId })
    .then(() => sendResponse({ success: true }))
    .catch((error) =>
      sendResponse({
        success: false,
        error: error?.message || 'Não foi possível abrir o módulo Compras.'
      })
    );

  return true;
});
