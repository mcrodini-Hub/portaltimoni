// Estado mínimo do módulo Marketing CT + persistência em chrome.storage.local.
// Compartilhado entre background.js (service worker) e sidebar.js (via <script> normal),
// por isso usa o objeto global `self`/`this` em vez de import/export de módulos ES.
// Esqueleto inicial: sem máquina de estados de fluxo ainda — isso será definido
// junto com as primeiras funcionalidades do módulo.

(function (root) {
  const STORAGE_KEY = 'marketingCtState';

  function defaultState() {
    return {
      pinned: false
    };
  }

  async function loadState() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return { ...defaultState(), ...(stored[STORAGE_KEY] || {}) };
  }

  async function saveState(state) {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    return state;
  }

  root.MarketingCTState = { STORAGE_KEY, defaultState, loadState, saveState };
})(typeof self !== 'undefined' ? self : this);
