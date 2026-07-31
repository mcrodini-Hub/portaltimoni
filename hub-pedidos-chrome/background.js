// Service worker — orquestra abertura/reaproveitamento de abas, roteia mensagens entre a
// sidebar e os content scripts, e é o único lugar que persiste o estado global.

importScripts('lib/state.js', 'lib/tabs.js', 'lib/messages.js', 'lib/validators.js');

// O board é sempre aberto já com o filtro nativo do Trello para a etiqueta "Rio Claro"
// aplicado via URL (?filter=label:Rio Claro) — o mesmo mecanismo que o próprio Trello usa
// para compartilhar um link de board pré-filtrado. Isso elimina a necessidade de detectar
// cor/texto de etiqueta cartão por cartão: com o filtro nativo aplicado, só precisamos ler
// quais cartões o Trello está exibindo (ver isCardVisible em content/trello-content.js).
const TRELLO_BOARD_URL = 'https://trello.com/b/UfPrTr1H/compras?filter=label:Rio%20Claro';
// Padrão amplo de propósito: encontrar QUALQUER aba do Trello já aberta na janela em foco,
// só para fechá-la antes de abrir uma nova no board (ver ensureTrelloBoardTab).
const TRELLO_URL_PATTERN = 'https://trello.com/*';
const DRIVE_FOLDER_URL = 'https://drive.google.com/drive/u/0/folders/1P7Nb1FwfSQ6e7TA9Wkgizyy53tGGQajk';
const DRIVE_URL_PATTERN = 'https://drive.google.com/*';
const SHEETS_URL_PATTERN = 'https://docs.google.com/spreadsheets/*';

const { STATES } = HubState;
const { TYPES } = HubMessages;

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

async function logError(message) {
  await HubState.setState({ currentState: STATES.ERRO, lastError: message });
}

// ---------------------------------------------------------------------------
// Espelho do estado na planilha do Painel Timoni (ver apps-script/Codigo.gs)
// ---------------------------------------------------------------------------
// O Compras continua funcionando 100% localmente (chrome.storage.local) mesmo sem essa URL
// configurada — este espelho é só para o Painel Timoni conseguir ler o estado de fora da
// extensão. Nunca lança erro nem atrasa/bloqueia o fluxo do usuário por falha de rede.

function buildEstadoParams(state) {
  const conferencia = state.conferencia || HubState.defaultConferencia();
  return {
    action: 'registrar',
    currentState: state.currentState || '',
    selectedSupplierNome: state.selectedSupplier ? state.selectedSupplier.nome : '',
    selectedSupplierUrgente: state.selectedSupplier ? String(!!state.selectedSupplier.urgente) : '',
    fornecedoresJson: JSON.stringify(state.suppliers || []),
    itensJson: JSON.stringify(state.extractedItems || []),
    bessaniUrl: state.bessaniUrl || '',
    bessaniPrintAnexado: String(!!state.bessaniPrint),
    conferenciaTipoDocumento: conferencia.tipoDocumento || '',
    conferenciaAprovado: conferencia.aprovado === null || conferencia.aprovado === undefined ? '' : String(conferencia.aprovado),
    conferenciaChecklistJson: JSON.stringify(conferencia.checklist || {}),
    conferenciaDivergenciasJson: JSON.stringify(conferencia.divergencias || []),
    trelloResultadosJson: JSON.stringify(state.trelloUpdateResults || []),
    diagnosticsJson: JSON.stringify(state.diagnostics || {})
  };
}

async function pushEstadoAoPainel(state) {
  if (!state.painelWebAppUrl) return;
  try {
    await fetch(state.painelWebAppUrl, { method: 'POST', body: new URLSearchParams(buildEstadoParams(state)) });
  } catch (e) {
    console.warn('Painel Timoni: falha ao espelhar estado (segue normalmente sem o painel):', e);
  }
}

async function pushHistoricoAoPainel(state) {
  if (!state.painelWebAppUrl) return;
  try {
    const resultados = state.trelloUpdateResults || [];
    const conta = (status) => resultados.filter((r) => r.status === status).length;
    const divergencias = (state.conferencia && state.conferencia.divergencias) || [];
    const params = {
      action: 'finalizar',
      fornecedor: state.selectedSupplier ? state.selectedSupplier.nome : '',
      itensCount: String((state.extractedItems || []).length),
      conferenciaAprovado: String(!!(state.conferencia && state.conferencia.aprovado === true)),
      divergenciasCount: String(divergencias.length),
      trelloAtualizados: String(conta('atualizado')),
      trelloIgnorados: String(conta('ignorado')),
      trelloNaoEncontrados: String(conta('não encontrado'))
    };
    await fetch(state.painelWebAppUrl, { method: 'POST', body: new URLSearchParams(params) });
  } catch (e) {
    console.warn('Painel Timoni: falha ao registrar histórico (segue normalmente sem o painel):', e);
  }
}

function getFocusedWindowId() {
  return new Promise((resolve) => {
    chrome.windows.getLastFocused({ windowTypes: ['normal'] }, (win) => {
      resolve(win && !chrome.runtime.lastError ? win.id : undefined);
    });
  });
}

function removeTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.remove(tabId, () => {
      // Ignora erro (aba já pode ter sido fechada) — o objetivo é só garantir que ela não
      // exista mais antes de abrir a nova.
      void chrome.runtime.lastError;
      resolve();
    });
  });
}

// Garante uma aba do Trello pronta para ler/escrever no board de Compras, sempre na URL
// exata TRELLO_BOARD_URL (board + filtro nativo "Rio Claro"). Fecha qualquer aba do Trello
// já aberta (na janela em foco) e abre uma nova, em vez de tentar reaproveitar/navegar a
// mesma aba — duas lições aprendidas em versões anteriores:
//   1. Se um cartão está aberto, a URL da aba vira trello.com/c/... e o Trello trata mudanças
//      de URL como navegação interna do SPA (History API); o carregamento "complete" pode não
//      disparar e o cartão fica aberto por cima da lista, fazendo a leitura falhar sem nada
//      mudar na tela.
//   2. Reaproveitar uma aba já aberta corre o risco de rodar um content script ANTIGO: o
//      Chrome não reinjeta script numa aba já aberta quando a extensão é atualizada, então
//      correções de código nunca chegariam a rodar ali até um reload de verdade.
// Fechar e abrir uma aba nova elimina os dois problemas de uma vez: carregamento limpo,
// sem cartão sobreposto, sempre com o código mais recente e com o filtro nativo aplicado.
async function ensureTrelloTabAt(url) {
  const windowId = await getFocusedWindowId();
  const tab = await HubTabs.findTab(TRELLO_URL_PATTERN, windowId);
  if (tab) {
    await removeTab(tab.id);
  }
  const fresh = await HubTabs.createTab(url, windowId);
  await HubTabs.waitForTabComplete(fresh.id);
  // Espera a SPA do Trello renderizar (não é só carregar o HTML, mas executar React/JS,
  // aplicar o filtro e desenhar a grade de cartões) — essencial para o content script
  // conseguir achar a lista e os cartões já filtrados.
  await new Promise((r) => setTimeout(r, 1800));
  return fresh;
}

async function ensureTrelloBoardTab() {
  return ensureTrelloTabAt(TRELLO_BOARD_URL);
}

async function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs && tabs[0] ? tabs[0] : null);
    });
  });
}

// ---------------------------------------------------------------------------
// Handlers por tipo de mensagem (Etapas 1-7 da especificação)
// ---------------------------------------------------------------------------

async function handleOpenTrello() {
  // handleScanTrello já abre o quadro; não abrir uma segunda vez aqui.
  return handleScanTrello();
}

async function handleScanTrello() {
  const tab = await ensureTrelloBoardTab();
  if (!tab) {
    const msg = 'Abra o Trello antes de ler os fornecedores.';
    await logError(msg);
    return { error: msg };
  }

  const result = await HubTabs.sendWithInjection(
    tab.id,
    ['lib/validators.js', 'content/trello-content.js'],
    HubMessages.makeMessage(TYPES.SCAN_TRELLO, null, 'background')
  );

  if (!result || result.error) {
    const msg = (result && result.error) || 'Não foi possível ler o Trello.';
    await logError(msg);
    return { error: msg };
  }

  let suppliers = result.suppliers || [];

  // A prioridade "Urgente" já é lida na mesma tela pelo content script.
  // Assim o Trello abre uma única vez por atualização.

  const newState = await HubState.setState({
    currentState: STATES.FORNECEDORES_CARREGADOS,
    suppliers,
    trelloScanned: true,
    lastError: null,
    diagnostics: {
      activeTabUrl: tab.url,
      cardsRead: result.diagnostics ? result.diagnostics.cardsRead : 0,
      rioClaroCards: result.diagnostics ? result.diagnostics.rioClaroCards : 0,
      usedDeepScan: result.diagnostics ? !!result.diagnostics.usedDeepScan : false,
      suppliersFound: suppliers.length,
      lastUpdatedAt: Date.now()
    }
  });
  await pushEstadoAoPainel(newState);

  return { suppliers };
}

async function handleSelectSupplier(payload) {
  const supplier = payload && payload.supplier;
  if (!supplier) return { error: 'Fornecedor inválido.' };

  const newState = await HubState.setState({
    currentState: STATES.FORNECEDOR_SELECIONADO,
    selectedSupplier: supplier,
    extractedItems: [],
    driveOpened: false,
    sheetUrl: '',
    bessaniUrl: '',
    bessaniPrint: null,
    conferencia: HubState.defaultConferencia(),
    trelloUpdateResults: [],
    lastError: null
  });
  await pushEstadoAoPainel(newState);

  return { selectedSupplier: supplier };
}

async function handleOpenDrive() {
  const state = await HubState.getState();
  if (!state.selectedSupplier) {
    return { error: 'Selecione um fornecedor antes de abrir o Google Drive.' };
  }

  const tab = await HubTabs.openOrActivateTab(DRIVE_URL_PATTERN, DRIVE_FOLDER_URL);
  await HubState.setState({ currentState: STATES.DRIVE_ABERTO, driveOpened: true, lastError: null });
  return { tabId: tab.id };
}

function spreadsheetTabPattern(url) {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  return match ? `https://docs.google.com/spreadsheets/d/${match[1]}/*` : `${parsed.origin}${parsed.pathname}*`;
}

async function handleExtractItems() {
  const state = await HubState.getState();
  let activeTab = await getActiveTab();

  // Se o usuário colou o link da planilha, abre/reaproveita essa aba específica em vez de
  // depender de já estar com ela ativa manualmente.
  if (state.sheetUrl) {
    let pattern;
    try {
      pattern = spreadsheetTabPattern(state.sheetUrl);
    } catch (e) {
      return { error: 'Link da planilha inválido.' };
    }
    try {
      const tab = await HubTabs.openOrActivateTab(pattern, state.sheetUrl);
      await HubTabs.waitForTabComplete(tab.id);
      activeTab = tab;
    } catch (e) {
      return { error: `Não foi possível abrir a planilha: ${e.message}` };
    }
  }

  if (!activeTab || !/^https:\/\/docs\.google\.com\/spreadsheets\//.test(activeTab.url || '')) {
    const msg = 'Cole o link da planilha acima, ou abra-a manualmente no Google Sheets e deixe-a na aba ativa antes de extrair.';
    return { error: msg };
  }

  await HubState.setState({ currentState: STATES.PLANILHA_ABERTA });

  const result = await HubTabs.sendWithInjection(
    activeTab.id,
    ['lib/validators.js', 'content/sheets-content.js'],
    HubMessages.makeMessage(TYPES.EXTRACT_ITEMS, null, 'background')
  );

  if (!result || result.error) {
    const msg = (result && result.error) || 'Não foi possível extrair os itens da planilha.';
    const extraDiag = (result && result.diagnostics) || {};
    await HubState.setState({
      currentState: STATES.ERRO,
      lastError: msg,
      diagnostics: Object.assign({ activeTabUrl: activeTab.url }, extraDiag)
    });
    return { error: msg };
  }

  const items = result.items || [];
  const newState = await HubState.setState({
    currentState: STATES.ITENS_EXTRAIDOS,
    extractedItems: items,
    lastError: null,
    diagnostics: {
      activeTabUrl: activeTab.url,
      itemsExtracted: items.length,
      lastUpdatedAt: Date.now()
    }
  });
  await pushEstadoAoPainel(newState);

  return { items };
}

async function handleSaveBessaniUrl(payload) {
  const url = payload && payload.url;
  if (!url) return { error: 'Link inválido.' };
  const newState = await HubState.setState({ bessaniUrl: url });
  await pushEstadoAoPainel(newState);
  return { bessaniUrl: url };
}

async function handleSaveBessaniPrint(payload) {
  const dataUrl = payload && payload.dataUrl;
  // dataUrl === null é usado para remover o print salvo.
  await HubState.setState({ bessaniPrint: dataUrl || null });
  return { ok: true };
}

async function handleSaveSheetUrl(payload) {
  const url = (payload && payload.url) || '';
  await HubState.setState({ sheetUrl: url });
  return { sheetUrl: url };
}

async function handleSaveConferencia(payload) {
  const conferencia = payload && payload.conferencia;
  if (!conferencia) return { error: 'Conferência inválida.' };
  const newState = await HubState.setState({ conferencia });
  await pushEstadoAoPainel(newState);
  return { conferencia };
}

async function handleSavePainelUrl(payload) {
  const url = (payload && payload.url) || '';
  const newState = await HubState.setState({ painelWebAppUrl: url });
  // Espelha o estado atual imediatamente, pra não esperar a próxima transição só pra o
  // painel deixar de mostrar "sem dados".
  await pushEstadoAoPainel(newState);
  return { painelWebAppUrl: url };
}

async function handleOpenBessani() {
  const state = await HubState.getState();
  if (!state.bessaniUrl) {
    return { error: 'Cole o link do Bessani antes de abrir.' };
  }
  let pattern;
  try {
    const parsed = new URL(state.bessaniUrl);
    pattern = `${parsed.origin}/*`;
  } catch (e) {
    return { error: 'Link do Bessani inválido.' };
  }

  await HubTabs.openOrActivateTab(pattern, state.bessaniUrl);
  await HubState.setState({ currentState: STATES.BESSANI_ABERTO });
  return { ok: true };
}

async function handleUpdateTrello() {
  const state = await HubState.getState();
  if (!state.selectedSupplier || !state.extractedItems || state.extractedItems.length === 0) {
    return { error: 'Não há itens extraídos para atualizar no Trello.' };
  }
  if (!state.conferencia || state.conferencia.aprovado !== true) {
    return {
      error: 'Conferência item a item do pedido ainda não foi aprovada (Etapa 5). ' +
        'Nenhum pedido é atualizado no Trello sem essa conferência — ver PROTOCOLO_CONFERENCIA_PEDIDOS.md.'
    };
  }

  const tab = await ensureTrelloBoardTab();
  if (!tab) {
    const msg = 'Abra o Trello antes de atualizar os cartões.';
    await logError(msg);
    return { error: msg };
  }

  await HubState.setState({ currentState: STATES.PRONTO_PARA_ATUALIZAR });

  const result = await HubTabs.sendWithInjection(
    tab.id,
    ['lib/validators.js', 'content/trello-content.js'],
    HubMessages.makeMessage(TYPES.UPDATE_TRELLO, {
      supplier: state.selectedSupplier,
      items: state.extractedItems
    }, 'background')
  );

  if (!result || result.error) {
    const msg = (result && result.error) || 'Não foi possível atualizar o Trello.';
    await logError(msg);
    return { error: msg };
  }

  const newState = await HubState.setState({
    currentState: STATES.FINALIZADO,
    trelloUpdateResults: result.results || [],
    lastError: null
  });
  await pushEstadoAoPainel(newState);
  await pushHistoricoAoPainel(newState);

  return { results: result.results || [] };
}

async function handleResetWorkflow() {
  const state = await HubState.resetState(true);
  return { state };
}

async function handleGetState() {
  return { state: await HubState.getState() };
}

async function handleTogglePin(payload) {
  const pinned = !!(payload && payload.pinned);
  const state = await HubState.setState({ pinned });
  return { state };
}

async function handleWorkflowError(payload) {
  const msg = (payload && payload.message) || 'Erro desconhecido.';
  await logError(msg);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Roteador central
// ---------------------------------------------------------------------------

const HANDLERS = {
  [TYPES.OPEN_TRELLO]: handleOpenTrello,
  [TYPES.SCAN_TRELLO]: handleScanTrello,
  [TYPES.SELECT_SUPPLIER]: handleSelectSupplier,
  [TYPES.OPEN_DRIVE]: handleOpenDrive,
  [TYPES.EXTRACT_ITEMS]: handleExtractItems,
  [TYPES.SAVE_BESSANI_URL]: handleSaveBessaniUrl,
  [TYPES.SAVE_BESSANI_PRINT]: handleSaveBessaniPrint,
  [TYPES.SAVE_SHEET_URL]: handleSaveSheetUrl,
  [TYPES.SAVE_CONFERENCIA]: handleSaveConferencia,
  [TYPES.SAVE_PAINEL_URL]: handleSavePainelUrl,
  [TYPES.OPEN_BESSANI]: handleOpenBessani,
  [TYPES.UPDATE_TRELLO]: handleUpdateTrello,
  [TYPES.RESET_WORKFLOW]: handleResetWorkflow,
  [TYPES.GET_STATE]: handleGetState,
  [TYPES.TOGGLE_PIN]: handleTogglePin,
  [TYPES.WORKFLOW_ERROR]: handleWorkflowError
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type || !HANDLERS[message.type]) return false;

  HANDLERS[message.type](message.payload)
    .then((result) => sendResponse(result))
    .catch((err) => sendResponse({ error: err.message }));

  return true; // resposta assíncrona
});
