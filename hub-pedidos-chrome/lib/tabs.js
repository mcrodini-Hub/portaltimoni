// Reaproveitamento de abas — usado somente no background.js (contexto com acesso a chrome.tabs).
// Regra: procurar aba existente pelo padrão de URL; se existir, ativar e focar a janela;
// se não existir, criar uma nova aba.

(function (root) {
  // Janela atualmente em foco (normal, não popup) — usada para restringir a busca de abas
  // à janela em que o usuário está de fato trabalhando. Sem isso, chrome.tabs.query({url})
  // procura em TODAS as janelas abertas; se sobrar uma aba antiga do Trello esquecida em
  // outra janela (de um teste anterior, por exemplo), a extensão podia silenciosamente
  // reaproveitar essa aba errada em vez da que o usuário está vendo, dando erro sem nenhuma
  // mudança visível na tela que a pessoa está olhando.
  function getFocusedWindowId() {
    return new Promise((resolve) => {
      chrome.windows.getLastFocused({ windowTypes: ['normal'] }, (win) => {
        resolve(win && !chrome.runtime.lastError ? win.id : undefined);
      });
    });
  }

  function findTab(urlPattern, windowId) {
    const query = { url: urlPattern };
    if (windowId !== undefined) query.windowId = windowId;
    return new Promise((resolve) => {
      chrome.tabs.query(query, (tabs) => {
        resolve(tabs && tabs.length > 0 ? tabs[0] : null);
      });
    });
  }

  function activateTab(tab) {
    return new Promise((resolve, reject) => {
      chrome.tabs.update(tab.id, { active: true }, (updated) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        chrome.windows.update(updated.windowId, { focused: true }, () => resolve(updated));
      });
    });
  }

  function createTab(url, windowId) {
    const props = { url, active: true };
    if (windowId !== undefined) props.windowId = windowId;
    return new Promise((resolve, reject) => {
      chrome.tabs.create(props, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(tab);
      });
    });
  }

  // Abre a URL informada ou ativa uma aba já existente que combine com urlPattern, sempre
  // restrito à janela em foco (ver getFocusedWindowId).
  async function openOrActivateTab(urlPattern, urlToOpen) {
    const windowId = await getFocusedWindowId();
    const existing = await findTab(urlPattern, windowId);
    if (existing) {
      return activateTab(existing);
    }
    return createTab(urlToOpen, windowId);
  }

  // Aguarda a aba terminar de carregar (status 'complete'), com timeout — Trello e Sheets
  // são páginas dinâmicas, então isso só garante o carregamento inicial do documento; o
  // conteúdo em si é aguardado dentro dos content scripts (MutationObserver + tentativas).
  function waitForTabComplete(tabId, timeoutMs) {
    const timeout = timeoutMs || 8000;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (tab) => {
        if (settled) return;
        settled = true;
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timer);
        resolve(tab || null);
      };

      chrome.tabs.get(tabId, (tab) => {
        if (!chrome.runtime.lastError && tab && tab.status === 'complete') {
          finish(tab);
        }
      });

      function listener(updatedTabId, changeInfo, tab) {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          finish(tab);
        }
      }
      chrome.tabs.onUpdated.addListener(listener);

      const timer = setTimeout(() => finish(null), timeout);
    });
  }

  // Garante que o content script esteja rodando na aba (útil quando a aba já estava aberta
  // antes da extensão carregar) e envia a mensagem, tentando reinjetar uma vez em caso de
  // falha por ausência de listener. Se a injeção falhar, tenta de novo após um delay
  // (pode haver race condition onde a aba está pronta mas o runtime ainda está inicializando).
  async function sendWithInjection(tabId, files, message) {
    const first = await sendMessageSafe(tabId, message);
    if (!first.__noReceiver) return first;

    try {
      await new Promise((resolve, reject) => {
        chrome.scripting.executeScript({ target: { tabId }, files }, () => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve();
        });
      });
    } catch (e) {
      // Se a injeção falhou, espera um pouco e tenta de novo (pode ser timing)
      await new Promise((r) => setTimeout(r, 500));
      try {
        await new Promise((resolve, reject) => {
          chrome.scripting.executeScript({ target: { tabId }, files }, () => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else resolve();
          });
        });
      } catch (e2) {
        return { error: `Não foi possível preparar a página: ${e2.message}` };
      }
    }

    // Espera um pouco antes de enviar a mensagem para garantir que o content script
    // processou a injeção e está pronto para ouvir
    await new Promise((r) => setTimeout(r, 200));
    return sendMessageSafe(tabId, message);
  }

  function sendMessageSafe(tabId, message) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ error: chrome.runtime.lastError.message, __noReceiver: true });
          return;
        }
        resolve(response);
      });
    });
  }

  root.HubTabs = {
    findTab,
    activateTab,
    createTab,
    openOrActivateTab,
    waitForTabComplete,
    sendWithInjection
  };
})(self);
