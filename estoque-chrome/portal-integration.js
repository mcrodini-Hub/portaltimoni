// Integração externa exclusiva com o Portal Timoni.
function novoResumo() {
  return {
    emAberto: 0,
    aguardandoCompra: 0,
    aguardandoChegada: 0,
    finalizadas: 0
  };
}

function classificarNecessidade(status) {
  if (status === 'pendente' || status === 'observacao') return 'emAberto';
  if (status === 'em_compra') return 'aguardandoCompra';
  if (status === 'pedido_existente') return 'aguardandoChegada';
  if (status === 'chegou') return 'finalizadas';
  return null;
}

function resumirNecessidades(lista) {
  const geral = novoResumo();
  const porUnidade = {
    rio_claro: novoResumo(),
    araras: novoResumo()
  };

  (lista || []).forEach((necessidade) => {
    const campo = classificarNecessidade(necessidade.status);
    if (!campo) return;

    geral[campo] += 1;
    const unidade = necessidade.unidade === 'araras' ? 'araras' : 'rio_claro';
    porUnidade[unidade][campo] += 1;
  });

  return { geral, porUnidade };
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message?.action === 'OPEN_ESTOQUE') {
    const windowId = sender.tab?.windowId;

    if (!chrome.sidePanel?.open || typeof windowId !== 'number') {
      sendResponse({
        success: false,
        error: 'Não foi possível identificar a janela do Portal.'
      });
      return false;
    }

    chrome.sidePanel
      .open({ windowId })
      .then(() => sendResponse({ success: true }))
      .catch((error) =>
        sendResponse({
          success: false,
          error: error.message
        })
      );

    return true;
  }

  if (message?.action === 'GET_ESTOQUE_SUMMARY') {
    EstoqueStore.getNecessidades({ forcar: true })
      .then((necessidades) =>
        sendResponse({
          success: true,
          version: chrome.runtime.getManifest().version,
          summary: resumirNecessidades(necessidades)
        })
      )
      .catch((error) =>
        sendResponse({
          success: false,
          version: chrome.runtime.getManifest().version,
          error: error.message
        })
      );

    return true;
  }

  return false;
});
