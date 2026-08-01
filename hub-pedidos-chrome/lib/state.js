// Máquina de estados do Compras + persistência em chrome.storage.local.
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

  // Estrutura antiga preservada apenas para compatibilidade com instalações anteriores.
  // A Conferência de pedidos agora é um módulo separado e não aparece na interface Compras.
  const CONFERENCIA_CHECKLIST_ITEMS = Object.freeze([
    { key: 'itensPresentes', label: 'Todos os itens do pedido aparecem no retorno do fornecedor' },
    { key: 'codigosConferem', label: 'Códigos do fornecedor batem com os do pedido' },
    { key: 'quantidadesConferem', label: 'Quantidades conferem' },
    { key: 'precoConfere', label: 'Preço unitário confere' },
    { key: 'ipiConfere', label: 'Alíquota de IPI confere' },
    { key: 'freteConfere', label: 'Frete e condição de pagamento conferem' },
    { key: 'totalConfere', label: 'Total do pedido confere' },
    { key: 'entregaConfere', label: 'Data de entrega e transportadora conferem' }
  ]);

  function defaultConferencia() {
    const checklist = {};
    CONFERENCIA_CHECKLIST_ITEMS.forEach((item) => { checklist[item.key] = false; });
    return {
      tipoDocumento: null,
      checklist,
      divergencias: [],
      aprovado: null,
      dataConferencia: null
    };
  }

  function defaultResumoCompras() {
    return {
      paraFazer: 0,
      urgentes: 0,
      enviadosRioClaro: 0,
      enviadosAraras: 0,
      atualizadoEm: null
    };
  }

  function defaultState() {
    return {
      currentState: STATES.INICIO,
      pinned: false,
      painelWebAppUrl: '',
      trelloScanned: false,
      driveOpened: false,
      selectedSupplier: null,
      suppliers: [],
      resumoCompras: defaultResumoCompras(),
      extractedItems: [],
      sheetUrl: '',
      sheetColumns: {
        codigo: '',
        descricao: '',
        quantidade: ''
      },
      bessaniUrl: '',
      bessaniPrint: null,
      conferencia: defaultConferencia(),
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
        const merged = Object.assign(defaultState(), stored || {});
        merged.resumoCompras = Object.assign(defaultResumoCompras(), stored?.resumoCompras || {});
        resolve(merged);
      });
    });
  }

  function setState(partial) {
    return getState().then((current) => {
      const next = Object.assign({}, current, partial);
      if (partial && partial.diagnostics) {
        next.diagnostics = Object.assign({}, current.diagnostics, partial.diagnostics);
      }
      if (partial && partial.resumoCompras) {
        next.resumoCompras = Object.assign({}, current.resumoCompras, partial.resumoCompras);
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
      // O resumo representa o Trello e não deve sumir ao iniciar outro fornecedor.
      fresh.resumoCompras = current.resumoCompras || defaultResumoCompras();
      return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY]: fresh }, () => resolve(fresh));
      });
    });
  }

  root.HubState = {
    STATES,
    getState,
    setState,
    resetState,
    STORAGE_KEY,
    CONFERENCIA_CHECKLIST_ITEMS,
    defaultConferencia,
    defaultResumoCompras
  };
})(self);
