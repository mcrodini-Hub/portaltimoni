// Content script do Trello — Etapas 2 e 7 da especificação.
// Regras: só considera a lista "PEDIDOS PENDENTES" (ou similares) e, dentro dela, só
// cartões com etiqueta verde "Rio Claro". Nunca mexe em cartões fora dessa lista/filtro.

(function () {
  const { normalizeText } = self.HubValidators;

  // Procura por "pedidos" (cobre "PEDIDOS PENDENTES", "RELAÇÃO DE PEDIDOS", etc.)
  const LIST_NAME_TOKENS = ['pedidos'];
  const TARGET_LABEL_TEXT = 'rio claro';
  const GREEN_HEX = ['#61bd4f', '#4bce97', '#216e4e', '#7bc86c', '#94c748', '#2f8132', '#1f845a', '#0f5132', '#519839'];

  // ---------------------------------------------------------------------
  // Espera por conteúdo dinâmico (MutationObserver + tentativas + timeout)
  // ---------------------------------------------------------------------
  function waitFor(conditionFn, { timeout = 8000, interval = 300 } = {}) {
    return new Promise((resolve) => {
      const start = Date.now();
      let observer = null;
      let poll = null;

      function cleanup() {
        if (observer) observer.disconnect();
        if (poll) clearInterval(poll);
      }

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

      observer = new MutationObserver(() => {
        if (tryNow()) return;
        if (Date.now() - start > timeout) cleanup();
      });
      observer.observe(document.body, { childList: true, subtree: true });

      poll = setInterval(() => {
        if (tryNow()) return;
        if (Date.now() - start > timeout) {
          cleanup();
          resolve(null);
        }
      }, interval);
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
    // O Trello renderiza as etiquetas na frente do cartão de formas diferentes conforme a
    // configuração do board: às vezes como barras coloridas SEM texto visível (só cor), às
    // vezes com o nome escrito. Por isso lemos texto de várias fontes possíveis (aria-label,
    // title/tooltip, texto visível) e usamos um seletor amplo.
    const labelEls = card.querySelectorAll(
      '[data-testid="card-label"], [data-testid="cardBadge"], [data-testid*="label" i], ' +
      '[data-testid*="badge" i], [class*="label" i], [class*="badge" i], .Badge, [title], [aria-label]'
    );
    const labels = [];
    labelEls.forEach((el) => {
      const text = (
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        el.textContent ||
        ''
      ).trim();
      if (!text) return;
      labels.push({ text, isGreen: colorLooksGreen(el), el });
    });
    return labels;
  }

  function labelTextMatches(text) {
    const normalized = normalizeText(text);
    return normalized === TARGET_LABEL_TEXT || normalized.includes(TARGET_LABEL_TEXT);
  }

  function isRioClaroCard(card) {
    const labels = getCardLabels(card);
    return labels.some((label) => {
      // Se a cor não puder ser determinada pelo DOM, aceita pelo texto (limitação conhecida:
      // ver TESTES.md / limitações). Se a cor for determinável, ela precisa ser verde.
      const colorOk = label.isGreen === null ? true : label.isGreen === true;
      return labelTextMatches(label.text) && colorOk;
    });
  }

  // ---------------------------------------------------------------------
  // Verificação profunda (fallback): abre cada cartão e lê a seção de
  // etiquetas no painel de detalhes, onde o Trello sempre mostra o nome por
  // extenso. Só é usada quando a leitura rápida na frente do cartão não
  // encontra nenhum cartão Rio Claro (evita depender só da barra colorida
  // compacta, que pode não trazer texto legível pelo scraping).
  function findExactTextLeaf(root, normalizedTarget) {
    const all = root.querySelectorAll('*');
    for (const el of all) {
      if (el.children.length > 0) continue;
      if (normalizeText(el.textContent) === normalizedTarget) return el;
    }
    return null;
  }

  function colorLooksGreenNear(el) {
    let node = el;
    for (let i = 0; i < 3 && node; i++) {
      const result = colorLooksGreen(node);
      if (result !== null) return result;
      node = node.parentElement;
    }
    return null;
  }

  async function cardHasRioClaroDeep(card) {
    const panel = await openCard(card);
    if (!panel) {
      closeCard();
      return false;
    }
    await new Promise((r) => setTimeout(r, 200));
    const leaf = findExactTextLeaf(document.body, TARGET_LABEL_TEXT);
    const isGreen = leaf ? colorLooksGreenNear(leaf) : null;
    const found = !!leaf && (isGreen === null || isGreen === true);
    closeCard();
    await new Promise((r) => setTimeout(r, 250));
    return found;
  }

  async function filterRioClaroDeep(cards, maxCards = 40) {
    const matched = [];
    const limited = cards.slice(0, maxCards);
    for (const card of limited) {
      try {
        if (await cardHasRioClaroDeep(card)) matched.push(card);
      } catch (e) {
        // Ignora esse cartão e segue para o próximo — um cartão com erro não deve travar
        // a listagem inteira.
      }
    }
    return matched;
  }

  // Usada tanto na Etapa 2 (listar) quanto na Etapa 7 (atualizar), para que as duas etapas
  // enxerguem exatamente o mesmo conjunto de cartões Rio Claro.
  async function getRioClaroCards(listEl) {
    const cards = getCardsFromList(listEl);
    let rioClaroCards = cards.filter(isRioClaroCard);
    let usedDeepScan = false;

    if (rioClaroCards.length === 0 && cards.length > 0) {
      // Antes de abrir cartão por cartão, tenta o atalho nativo do Trello que mostra o nome
      // das etiquetas na frente de todos os cartões (tecla "L" com o board em foco). Se o
      // Trello aceitar o evento sintético, os cartões passam a ter texto legível e a
      // verificação lenta deixa de ser necessária; se não aceitar (alguns apps ignoram
      // eventos de teclado não confiáveis), simplesmente não muda nada e segue pro fallback.
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', code: 'KeyL', keyCode: 76, which: 76, bubbles: true }));
      await new Promise((r) => setTimeout(r, 300));
      rioClaroCards = cards.filter(isRioClaroCard);
    }

    if (rioClaroCards.length === 0 && cards.length > 0) {
      usedDeepScan = true;
      rioClaroCards = await filterRioClaroDeep(cards);
    }
    return { cards, rioClaroCards, usedDeepScan };
  }

  // ---------------------------------------------------------------------
  // Etapa 2 — listar fornecedores
  // ---------------------------------------------------------------------
  async function listarFornecedores() {
    const listEl = await waitFor(findListElement, { timeout: 8000 });
    if (!listEl) {
      return { error: 'Lista de pedidos não encontrada no Trello. Verifique se o board carregou totalmente.' };
    }

    await waitFor(() => {
      const found = getCardsFromList(listEl);
      return found.length > 0 ? found : null;
    }, { timeout: 5000 });

    const { cards, rioClaroCards, usedDeepScan } = await getRioClaroCards(listEl);

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
        rioClaroCards: rioClaroCards.length,
        usedDeepScan
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
      return { error: 'Lista de pedidos não encontrada no Trello.' };
    }

    const { rioClaroCards } = await getRioClaroCards(listEl);
    const targetKey = normalizeText(supplierName);
    const matches = rioClaroCards.filter((card) => normalizeText(getCardName(card)) === targetKey);

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
