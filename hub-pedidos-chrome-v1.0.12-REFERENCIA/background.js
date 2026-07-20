// Background service worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('Hub de Pedidos - Extensão instalada!');
  console.log('Clique no ícone da extensão para iniciar');
});

// Manter o service worker ativo
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'keepAlive') {
    sendResponse({ status: 'alive' });
  }
});
