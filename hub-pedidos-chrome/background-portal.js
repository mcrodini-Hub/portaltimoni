// Service worker principal da extensão Compras.
// Carrega o fluxo existente e acrescenta a ponte segura com o Portal Timoni.
importScripts('background.js');

const PORTAL_TIMONI_ORIGIN = 'https://portaltimoni.vercel.app';
const TRELLO_PATTERN_PORTAL = 'https://trello.com/*';

// Acrescenta o resumo operacional em todos os espelhamentos, sem apagar os demais campos.
const buildEstadoParamsBase = buildEstadoParams;
buildEstadoParams = function buildEstadoParamsComResumo(state) {
  const params = buildEstadoParamsBase(state);
  params.resumoComprasJson = JSON.stringify(
    state.resumoCompras || HubState.defaultResumoCompras()
  );
  return params;
};

async function lerResumoDoTrello() {
  const tab = await HubTabs.findTab(TRELLO_PATTERN_PORTAL);
  if (!tab?.id) throw new Error('Aba do Trello não encontrada para calcular o resumo.');

  const result = await HubTabs.sendWithInjection(
    tab.id,
    ['content/trello-resumo.js'],
    { type: 'SCAN_TRELLO_RESUMO' }
  );

  if (!result || result.error || !result.resumo) {
    throw new Error(result?.error || 'Não foi possível calcular o resumo do Trello.');
  }

  const state = await HubState.setState({
    resumoCompras: result.resumo,
    diagnostics: {
      resumoAtualizadoEm: result.resumo.atualizadoEm,
      listasResumo: result.resumo.listasEncontradas || null
    }
  });

  await pushEstadoAoPainel(state);
  return result.resumo;
}

async function executarComResumo(handler, payload) {
  const result = await handler(payload);
  if (result?.error) return result;

  try {
    const resumo = await lerResumoDoTrello();
    return { ...result, resumo };
  } catch (error) {
    // A listagem principal continua funcionando mesmo que o espelho falhe.
    console.warn('Portal Timoni: não foi possível atualizar o resumo de Compras:', error);
    return result;
  }
}

// Tanto "Abrir Trello" quanto "Atualizar fornecedores" passam a atualizar os totais.
[TYPES.OPEN_TRELLO, TYPES.SCAN_TRELLO].forEach((type) => {
  const originalHandler = HANDLERS[type];
  HANDLERS[type] = (payload) => executarComResumo(originalHandler, payload);
});

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
