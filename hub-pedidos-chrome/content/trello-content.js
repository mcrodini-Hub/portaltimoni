// Content script do Trello — Etapas 2 e 7 da especificação.
// Regras: só considera a lista "RELAÇÃO DE PEDIDOS" e, dentro dela, só cartões com etiqueta
// verde "Rio Claro". Nunca mexe em cartões fora dessa lista/filtro.

(function () {
  const { normalizeText } = self.HubValidators;

  const LIST_NAME_TOKENS = ['relacao', 'pedidos']; // cobre "RELAÇÃO DE PEDIDOS" e variações reais
  const TARGET_LABEL_TEXT = 'rio claro';
  const GREEN_HEX = ['#61bd4f', '#4bce97', '#216e4e', '#7bc86c', '#94c748', '#2f8132', '#1f845a', '#0f5132', '#519839'];

  // ---------------------------------------------------------------------
  // Espera por conteúdo dinâmico (MutationObserver + tentativas + timeout)
  // ---------------------------------------------------------------------
  function waitFor(conditionFn, { timeout = 8000, interval = 300 } = {}) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tryNow = () => {
        const value = conditionFn();
        if (value) {
          cleanup();
          resolve(value);
          return true;
        }
        return false;
      };

      if (tryNow()) return;

      const observer = new MutationObserver(() => {
        if (tryNow()) return;
        if (Date.now() - start > timeout) cleanup();
      });
      observer.observe(document.body, { childList: true, subtree: true });

      const poll = setInterval(() => {
        if (tryNow()) return;
        if (Date.now() - start > timeout) {
          cleanup();
          resolve(null);
        }
      }, interval);

      function cleanup() {
        observer.disconnect();
        clearInterval(poll);
      }
    });
  }

  function findListElement() {
    const candidates = document.querySelectorAll('[data-testid="list"], [role="listitem"], [role="region"]');
    for (const el of candidates) {
      const title = normalizeText(el.textContent.slice(0, 200));
      if (LIST_NAME_TOKENS.every((tok) => title.includes(tok))) {
        return el;
      }
    }
    return null;
  }

  function getCardsFromList(listEl) {
    let cards = Array.from(listEl.querySelectorAll('[data-testid="trello-card"]'));
    if (cards.length === 0) {
      cards = Array.from(listEl.querySelectorAll('a[href*="/c/"]'));
    }
    return cards;
  }

  function getCardName(card) {
    const nameEl = card.querySelector('[data-testid="card-name"]');
    if (nameEl && nameEl.textContent.trim()) return nameEl.textContent.trim();
    const text = (card.textContent || card.innerText || '').trim();
    return text.split('\n')[0].trim();
  }

  function colorLooksGreen(el) {
    const dataColor = (el.getAttribute('data-color') || '').toLowerCase();
    if (dataColor) return dataColor.includes('green') || dataColor.includes('lime');

    const className = (el.className || '').toString().toLowerCase();
    if (className.includes('green') || className.includes('lime')) return true;

    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    if (ariaLabel.includes('green') || ariaLabel.includes('verde')) return true;

    const bg = getComputedStyle(el).backgroundColor || '';
    if (GREEN_HEX.some((hex) => bg.includes(hex))) return true;

    const rgbMatch = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      if (g > r * 1.15 && g > b * 1.05 && g > 80) return true;
    }

    return null; // não foi possível determinar a cor
  }

  function getCardLabels(card) {
    const labelEls = card.querySelectorAll(
      '[data-testid="card-label"], [data-testid="cardBadge"], [class*="label" i], .Badge'
    );
    const labels = [];
    labelEls.forEach((el) => {
      const text = (el.getAttribute('aria-label') || el.textContent || '').trim();
      if (!text) return;
      labels.push({ text, isGreen: colorLooksGreen(el), el });
    });
    return labels;
  }

  function isRioClaroCard(card) {
    const labels = getCardLabels(card);
    return labels.some((label) => {
      const normalized = normalizeText(label.text);
      const textMatches = normalized === TARGET_LABEL_TEXT || normalized.includes(TARGET_LABEL_TEXT);
      // Se a cor não puder ser determinada pelo DOM, aceita pelo texto (limitação conhecida:
      // ver TESTES.md / limitações). Se a cor for determinável, ela precisa ser verde.
      const colorOk = label.isGreen === null ? true : label.isGreen === true;
      return textMatches && colorOk;
    });
  }

  // ---------------------------------------------------------------------
  // Etapa 2 — listar fornecedores
  // ---------------------------------------------------------------------
  async function listarFornecedores() {
    const listEl = await waitFor(findListElement, { timeout: 8000 });
    if (!listEl) {
      return { error: 'Lista "RELAÇÃO DE PEDIDOS" não encontrada no Trello. Verifique se o board carregou totalmente.' };
    }

    const cards = await waitFor(() => {
      const found = getCardsFromList(listEl);
      return found.length > 0 ? found : null;
    }, { timeout: 5000 }) || getCardsFromList(listEl);

    const rioClaroCards = cards.filter(isRioClaroCard);

    const seen = new Set();
    const suppliers = [];
    rioClaroCards.forEach((card) => {
      const nome = getCardName(card);
      if (!nome) return;
      const key = normalizeText(nome);
      if (seen.has(key)) return;
      seen.add(key);
      suppliers.push({ nome });
    });

    suppliers.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    return {
      suppliers,
      diagnostics: {
        cardsRead: cards.length,
        rioClaroCards: rioClaroCards.length
      }
    };
  }

  // ---------------------------------------------------------------------
  // Etapa 7 — atualizar cartões do fornecedor selecionado
  // ---------------------------------------------------------------------
  function formatDescricao(items) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const linhas = items.map((it) => `${it.codigo} | ${it.descricao} | ${it.quantidade}`);
    return `${linhas.join('\n')}\n[Atualizado em ${timestamp}]`;
  }

  async function openCard(card) {
    card.click();
    const panel = await waitFor(
      () => document.querySelector('[data-testid="card-back-textarea"], [data-testid="card-details"], textarea[name="description"]'),
      { timeout: 5000 }
    );
    return panel;
  }

  async function writeDescription(descricao) {
    const field =
      document.querySelector('textarea[name="description"]') ||
      document.querySelector('[data-testid="card-back-textarea"]') ||
      document.querySelector('[data-testid="card-details"] [role="textbox"]');

    if (!field) return false;

    field.click();
    await new Promise((r) => setTimeout(r, 150));

    if ('value' in field) {
      field.value = descricao;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      field.textContent = descricao;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await new Promise((r) => setTimeout(r, 150));

    const saveBtn = document.querySelector('[data-testid="card-back-textarea-save"], button[type="submit"]');
    if (saveBtn) saveBtn.click();

    return true;
  }

  function closeCard() {
    const closeBtn = document.querySelector('[data-testid="popover-close"], button[aria-label="Close"], button[aria-label="Fechar"]');
    if (closeBtn) closeBtn.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }

  async function atualizarFornecedor(supplierName, items) {
    const listEl = await waitFor(findListElement, { timeout: 8000 });
    if (!listEl) {
      return { error: 'Lista "RELAÇÃO DE PEDIDOS" não encontrada no Trello.' };
    }

    const cards = getCardsFromList(listEl).filter(isRioClaroCard);
    const targetKey = normalizeText(supplierName);
    const matches = cards.filter((card) => normalizeText(getCardName(card)) === targetKey);

    if (matches.length === 0) {
      return { results: [{ card: supplierName, status: 'não encontrado' }] };
    }

    const descricao = formatDescricao(items);
    const results = [];
    let jaAtualizado = false;

    for (const card of matches) {
      if (jaAtualizado) {
        results.push({ card: supplierName, status: 'ignorado' });
        continue;
      }
      try {
        const panel = await openCard(card);
        if (!panel) {
          results.push({ card: supplierName, status: 'erro', detalhe: 'Painel do cartão não abriu.' });
          continue;
        }
        const ok = await writeDescription(descricao);
        closeCard();
        if (ok) {
          results.push({ card: supplierName, status: 'atualizado' });
          jaAtualizado = true;
        } else {
          results.push({ card: supplierName, status: 'erro', detalhe: 'Campo de descrição não encontrado.' });
        }
      } catch (e) {
        results.push({ card: supplierName, status: 'erro', detalhe: e.message });
      }
    }

    return { results };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SCAN_TRELLO') {
      listarFornecedores().then(sendResponse).catch((e) => sendResponse({ error: e.message }));
      return true;
    }
    if (request.type === 'UPDATE_TRELLO') {
      const { supplier, items } = request.payload || {};
      atualizarFornecedor(supplier && supplier.nome, items || [])
        .then(sendResponse)
        .catch((e) => sendResponse({ error: e.message }));
      return true;
    }
    return false;
  });
})();
