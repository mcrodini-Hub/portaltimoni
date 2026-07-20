// Máquina de estados do Hub de Pedidos + persistência em chrome.storage.local.
// Compartilhado entre background.js (service worker) e sidebar.js (via <script> normal),
// por isso usa o objeto global `self` em vez de import/export de módulos ES.

(function (root) {
  const STATES = Object.freeze({
    INICIO: 'INICIO',
    TRELLO_ABERTO: 'TRELLO_ABERTO',
    FORNECEDORES_CARREGADOS: 'FORNECEDORES_CARREGADOS',
    FORNECEDOR_SELECIONADO: 'FORNECEDOR_SELECIONADO',
    DRIVE_ABERTO: 'DRIVE_ABERTO',
    PLANILHA_ABERTA: 'PLANILHA_ABERTA',
    ITENS_EXTRAIDOS: 'ITENS_EXTRAIDOS',
    BESSANI_ABERTO: 'BESSANI_ABERTO',
    PRONTO_PARA_ATUALIZAR: 'PRONTO_PARA_ATUALIZAR',
    FINALIZADO: 'FINALIZADO',
    ERRO: 'ERRO'
  });

  const STORAGE_KEY = 'hubPedidosState';

  function defaultState() {
    return {
      currentState: STATES.INICIO,
      pinned: false,
      trelloScanned: false,
      driveOpened: false,
      selectedSupplier: null,
      suppliers: [],
      extractedItems: [],
      sheetUrl: '',
      bessaniUrl: '',
      bessaniPrint: null,
      lastError: null,
      diagnostics: {
        activeTabUrl: null,
        cardsRead: 0,
        rioClaroCards: 0,
        suppliersFound: 0,
        itemsExtracted: 0,
        lastUpdatedAt: null
      },
      trelloUpdateResults: []
    };
  }

  function getState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const stored = result && result[STORAGE_KEY];
        resolve(Object.assign(defaultState(), stored || {}));
      });
    });
  }

  function setState(partial) {
    return getState().then((current) => {
      const next = Object.assign({}, current, partial);
      if (partial && partial.diagnostics) {
        next.diagnostics = Object.assign({}, current.diagnostics, partial.diagnostics);
      }
      return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY]: next }, () => resolve(next));
      });
    });
  }

  function resetState(keepPinned) {
    return getState().then((current) => {
      const fresh = defaultState();
      if (keepPinned) fresh.pinned = current.pinned;
      return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY]: fresh }, () => resolve(fresh));
      });
    });
  }

  root.HubState = { STATES, getState, setState, resetState, STORAGE_KEY };
})(self);
