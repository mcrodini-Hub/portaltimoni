// Reaproveitamento de abas — usado somente no background.js (contexto com acesso a chrome.tabs).
// Regra: procurar aba existente pelo padrão de URL; se existir, ativar e focar a janela;
// se não existir, criar uma nova aba.

(function (root) {
  function findTab(urlPattern) {
    return new Promise((resolve) => {
      chrome.tabs.query({ url: urlPattern }, (tabs) => {
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

  function createTab(url) {
    return new Promise((resolve, reject) => {
      chrome.tabs.create({ url, active: true }, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(tab);
      });
    });
  }

  // Abre a URL informada ou ativa uma aba já existente que combine com urlPattern.
  async function openOrActivateTab(urlPattern, urlToOpen) {
    const existing = await findTab(urlPattern);
    if (existing) {
      return activateTab(existing);
    }
    return createTab(urlToOpen);
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
  // falha por ausência de listener.
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
      return { error: `Não foi possível preparar a página: ${e.message}` };
    }

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
