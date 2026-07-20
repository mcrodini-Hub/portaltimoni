// Service worker — orquestra abertura/reaproveitamento de abas, roteia mensagens entre a
// sidebar e os content scripts, e é o único lugar que persiste o estado global.

importScripts('lib/state.js', 'lib/tabs.js', 'lib/messages.js');

const TRELLO_BOARD_URL = 'https://trello.com/b/UfPrTr1H/compras';
// Escopo restrito ao board de Compras — um padrão genérico "trello.com/*" reaproveitaria
// qualquer aba do Trello, inclusive a página de um cartão específico (trello.com/c/...),
// que não tem a lista renderizada da mesma forma.
const TRELLO_URL_PATTERN = 'https://trello.com/b/UfPrTr1H/*';
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

async function findTrelloTab() {
  return HubTabs.findTab(TRELLO_URL_PATTERN);
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
  const tab = await HubTabs.openOrActivateTab(TRELLO_URL_PATTERN, TRELLO_BOARD_URL);
  await HubTabs.waitForTabComplete(tab.id);
  await HubState.setState({ currentState: STATES.TRELLO_ABERTO, lastError: null });
  return handleScanTrello();
}

async function handleScanTrello() {
  const tab = await findTrelloTab();
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

  const suppliers = result.suppliers || [];
  await HubState.setState({
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

  return { suppliers };
}

async function handleSelectSupplier(payload) {
  const supplier = payload && payload.supplier;
  if (!supplier) return { error: 'Fornecedor inválido.' };

  await HubState.setState({
    currentState: STATES.FORNECEDOR_SELECIONADO,
    selectedSupplier: supplier,
    extractedItems: [],
    driveOpened: false,
    sheetUrl: '',
    bessaniUrl: '',
    bessaniPrint: null,
    trelloUpdateResults: [],
    lastError: null
  });

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
  const current = await HubState.getState();
  await HubState.setState({
    currentState: STATES.ITENS_EXTRAIDOS,
    extractedItems: items,
    lastError: null,
    diagnostics: {
      activeTabUrl: activeTab.url,
      itemsExtracted: items.length,
      lastUpdatedAt: Date.now()
    }
  });

  return { items };
}

async function handleSaveBessaniUrl(payload) {
  const url = payload && payload.url;
  if (!url) return { error: 'Link inválido.' };
  await HubState.setState({ bessaniUrl: url });
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

  const tab = await findTrelloTab();
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

  await HubState.setState({
    currentState: STATES.FINALIZADO,
    trelloUpdateResults: result.results || [],
    lastError: null
  });

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
