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

  // Itens do checklist item a item da Etapa 5 (Conferência), conforme
  // PROTOCOLO_CONFERENCIA_PEDIDOS.md — comparação do pedido MCR contra o
  // documento de retorno do fornecedor (orçamento ou NF-e) antes de aprovar.
  const CONFERENCIA_CHECKLIST_ITEMS = Object.freeze([
    { key: 'itensPresentes', label: 'Todos os itens do pedido aparecem no retorno do fornecedor' },
    { key: 'codigosConferem', label: 'Códigos do fornecedor batem com os do pedido' },
    { key: 'quantidadesConferem', label: 'Quantidades conferem (atenção à unidade: PC, PL, UN, JG, KG)' },
    { key: 'precoConfere', label: 'Preço unitário confere com o negociado/pedido' },
    { key: 'ipiConfere', label: 'Alíquota de IPI confere' },
    { key: 'freteConfere', label: 'Frete e condição de pagamento conferem' },
    { key: 'totalConfere', label: 'Total do pedido bate com o total do documento do fornecedor' },
    { key: 'entregaConfere', label: 'Data de entrega e transportadora conferem' }
  ]);

  function defaultConferencia() {
    const checklist = {};
    CONFERENCIA_CHECKLIST_ITEMS.forEach((item) => { checklist[item.key] = false; });
    return {
      tipoDocumento: null, // 'orcamento' | 'nfe'
      checklist,
      divergencias: [],
      aprovado: null, // null (pendente) | true | false
      dataConferencia: null
    };
  }

  function defaultState() {
    return {
      currentState: STATES.INICIO,
      pinned: false,
      regiao: (root.HubRegioes && root.HubRegioes.DEFAULT_REGIAO_ID) || 'rio-claro',
      trelloScanned: false,
      driveOpened: false,
      selectedSupplier: null,
      suppliers: [],
      extractedItems: [],
      sheetUrl: '',
      bessaniUrl: '',
      bessaniPrint: null,
      conferencia: defaultConferencia(),
      numeroPedido: '',
      dataEnvio: '',
      dataEntrega: '',
      lastError: null,
      diagnostics: {
        activeTabUrl: null,
        cardsRead: 0,
        rioClaroCards: 0,
        suppliersFound: 0,
        itemsExtracted: 0,
        lastUpdatedAt: null
      },
      trelloUpdateResults: [],
      trelloUpdatePronto: false
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
      // Região é uma preferência de sessão (qual etiqueta/board filtrar), não dado de um
      // pedido específico — "Reiniciar fluxo" não deve forçar a usuária a reselecionar.
      fresh.regiao = current.regiao;
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
    defaultConferencia
  };
})(self);
