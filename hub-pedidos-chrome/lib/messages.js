// Tipos de mensagem e envelope padrão trocados entre sidebar, background e content scripts.

(function (root) {
  const TYPES = Object.freeze({
    OPEN_TRELLO: 'OPEN_TRELLO',
    SCAN_TRELLO: 'SCAN_TRELLO',
    SUPPLIERS_FOUND: 'SUPPLIERS_FOUND',
    SELECT_SUPPLIER: 'SELECT_SUPPLIER',
    OPEN_DRIVE: 'OPEN_DRIVE',
    EXTRACT_ITEMS: 'EXTRACT_ITEMS',
    ITEMS_EXTRACTED: 'ITEMS_EXTRACTED',
    OPEN_BESSANI: 'OPEN_BESSANI',
    SAVE_BESSANI_URL: 'SAVE_BESSANI_URL',
    SAVE_BESSANI_PRINT: 'SAVE_BESSANI_PRINT',
    SAVE_SHEET_URL: 'SAVE_SHEET_URL',
    SAVE_CONFERENCIA: 'SAVE_CONFERENCIA',
    SAVE_PAINEL_URL: 'SAVE_PAINEL_URL',
    UPDATE_TRELLO: 'UPDATE_TRELLO',
    STATE_UPDATED: 'STATE_UPDATED',
    WORKFLOW_ERROR: 'WORKFLOW_ERROR',
    RESET_WORKFLOW: 'RESET_WORKFLOW',
    GET_STATE: 'GET_STATE',
    TOGGLE_PIN: 'TOGGLE_PIN'
  });

  function makeMessage(type, payload, source) {
    return {
      type,
      payload: payload === undefined ? null : payload,
      source: source || 'unknown',
      timestamp: Date.now()
    };
  }

  // Envia mensagem ao background e resolve com a resposta. Nunca rejeita por falta de
  // listener (chrome.runtime.lastError é tratado) — quem chama decide o que fazer com erro
  // vindo dentro do payload de resposta.
  function send(type, payload, source) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(makeMessage(type, payload, source), (response) => {
        if (chrome.runtime.lastError) {
          resolve({ error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response);
      });
    });
  }

  function sendToTab(tabId, type, payload, source) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, makeMessage(type, payload, source), (response) => {
        if (chrome.runtime.lastError) {
          resolve({ error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response);
      });
    });
  }

  root.HubMessages = { TYPES, makeMessage, send, sendToTab };
})(self);
