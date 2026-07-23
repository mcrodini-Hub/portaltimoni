// Content script do Trello — Etapas 2 e 6 da especificação.
// Regras: só considera a lista "PEDIDOS PENDENTES" (ou similares) e, dentro dela, só
// cartões com a etiqueta da região corrente (ver lib/regioes.js). Nunca mexe em cartões
// fora dessa lista/filtro.

(function () {
  const { normalizeText } = self.HubValidators;

  // Procura pelos tokens "pedidos" E "pendentes" — essa combinação acha especificamente
  // "PEDIDOS PENDENTES" sem pegar outras listas que possam ter "pedidos" no nome.
  const LIST_NAME_TOKENS = ['pedidos', 'pendentes'];

  // Listas usadas nas heurísticas de cor (best-effort — Trello não expõe a cor de forma
  // 100% padronizada no DOM, ver TESTES.md). Cada região tem sua cor de etiqueta (Rio Claro
  // = verde, Araras = azul); se o texto da etiqueta não puder ser lido, cai pra essa
  // detecção de cor como segundo critério.
  const HUE_HEX = {
    green: ['#61bd4f', '#4bce97', '#216e4e', '#7bc86c', '#94c748', '#2f8132', '#1f845a', '#0f5132', '#519839'],
    blue: ['#0079bf', '#0091ae', '#026aa7', '#579dff', '#0c66e4', '#1d7afc', '#4bade8', '#2b7ecc', '#1868db']
  };

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
    // Tenta múltiplos seletores em ordem de preferência
    const selectorCandidates = [
      '[data-testid="list"]',      // Seletor nativo do Trello
      '[role="region"]',            // Elemento ARIA
      '[class*="list"]',            // Classe genérica
      '.js-list',                   // Classe JS legacy
      '[data-list-id]',             // Atributo de lista
      '.trello-list',               // Classe alternativa
    ];

    for (const selector of selectorCandidates) {
      const candidates = document.querySelectorAll(selector);
      for (const el of candidates) {
        // Procura por qualquer elemento dentro que contenha o nome da lista
        // Começa procurando nos filhos diretos (headers, títulos)
        let textToCheck = el.textContent;

        // Se o texto for muito grande, procura pelo header/título separadamente
        const header = el.querySelector('[class*="title"], [class*="header"], h1, h2, h3, [data-testid="list-name"]');
        if (header) {
          textToCheck = header.textContent;
        }

        const normalized = normalizeText(textToCheck);
        // Requer AMBOS "pedidos" e "pendentes"
        if (LIST_NAME_TOKENS.every((tok) => normalized.includes(tok))) {
          return el;
        }
      }
    }

    return null;
  }

  function getCardsFromList(listEl) {
    // Tenta múltiplos seletores para encontrar cartões
    const selectors = [
      '[data-testid="trello-card"]',        // Seletor nativo
      'a[href*="/c/"]',                      // Link para cartão
      '[class*="card"]',                     // Classe genérica
      '[data-testid*="card"]',               // Variações de data-testid
      '[role="button"][href*="/c/"]',       // Botão ARIA com link
    ];

    for (const selector of selectors) {
      const found = Array.from(listEl.querySelectorAll(selector));
      if (found.length > 0) {
        return found;
      }
    }

    return [];
  }

  function getCardName(card) {
    const nameEl = card.querySelector('[data-testid="card-name"]');
    if (nameEl && nameEl.textContent.trim()) return nameEl.textContent.trim();
    const text = (card.textContent || card.innerText || '').trim();
    return text.split('\n')[0].trim();
  }

  function colorLooksHue(el, hue) {
    const hexList = HUE_HEX[hue] || [];
    const dataColor = (el.getAttribute('data-color') || '').toLowerCase();
    if (dataColor) {
      if (hue === 'green') return dataColor.includes('green') || dataColor.includes('lime');
      if (hue === 'blue') return dataColor.includes('blue') || dataColor.includes('sky');
    }

    const className = (el.className || '').toString().toLowerCase();
    if (className.includes(hue)) return true;
    if (hue === 'green' && className.includes('lime')) return true;
    if (hue === 'blue' && className.includes('sky')) return true;

    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    if (ariaLabel.includes(hue)) return true;
    if (hue === 'green' && ariaLabel.includes('verde')) return true;
    if (hue === 'blue' && ariaLabel.includes('azul')) return true;

    const bg = getComputedStyle(el).backgroundColor || '';
    if (hexList.some((hex) => bg.includes(hex))) return true;

    const rgbMatch = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      if (hue === 'green' && g > r * 1.15 && g > b * 1.05 && g > 80) return true;
      if (hue === 'blue' && b > r * 1.05 && b > g * 1.05 && b > 80) return true;
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
      labels.push({ text, el });
    });
    return labels;
  }

  function labelTextMatches(text, targetNormalized) {
    const normalized = normalizeText(text);
    return normalized === targetNormalized || normalized.includes(targetNormalized);
  }

  function isTargetLabelCard(card, targetNormalized, corHint) {
    const labels = getCardLabels(card);
    return labels.some((label) => {
      // Se a cor não puder ser determinada pelo DOM, aceita pelo texto (limitação conhecida:
      // ver TESTES.md / limitações). Se a cor for determinável, ela precisa bater com corHint.
      const isHue = corHint ? colorLooksHue(label.el, corHint) : null;
      const colorOk = isHue === null ? true : isHue === true;
      return labelTextMatches(label.text, targetNormalized) && colorOk;
    });
  }

  // ---------------------------------------------------------------------
  // Verificação profunda (fallback): abre cada cartão e lê a seção de
  // etiquetas no painel de detalhes, onde o Trello sempre mostra o nome por
  // extenso. Só é usada quando a leitura rápida na frente do cartão não
  // encontra nenhum cartão com a etiqueta da região (evita depender só da
  // barra colorida compacta, que pode não trazer texto legível pelo scraping).
  function findExactTextLeaf(root, normalizedTarget) {
    const all = root.querySelectorAll('*');
    for (const el of all) {
      if (el.children.length > 0) continue;
      if (normalizeText(el.textContent) === normalizedTarget) return el;
    }
    return null;
  }

  function colorLooksHueNear(el, hue) {
    let node = el;
    for (let i = 0; i < 3 && node; i++) {
      const result = colorLooksHue(node, hue);
      if (result !== null) return result;
      node = node.parentElement;
    }
    return null;
  }

  async function cardHasTargetLabelDeep(card, targetNormalized, corHint) {
    const panel = await openCard(card);
    if (!panel) {
      closeCard();
      return false;
    }
    await new Promise((r) => setTimeout(r, 200));
    const leaf = findExactTextLeaf(document.body, targetNormalized);
    const isHue = leaf && corHint ? colorLooksHueNear(leaf, corHint) : null;
    const found = !!leaf && (isHue === null || isHue === true);
    closeCard();
    await new Promise((r) => setTimeout(r, 250));
    return found;
  }

  async function filterTargetLabelDeep(cards, targetNormalized, corHint, maxCards = 40) {
    const matched = [];
    const limited = cards.slice(0, maxCards);
    for (const card of limited) {
      try {
        if (await cardHasTargetLabelDeep(card, targetNormalized, corHint)) matched.push(card);
      } catch (e) {
        // Ignora esse cartão e segue para o próximo — um cartão com erro não deve travar
        // a listagem inteira.
      }
    }
    return matched;
  }

  // O background.js sempre abre o board com o filtro nativo do Trello aplicado via URL
  // (?filter=label:<etiqueta da região>) — o Trello esconde (não apenas destaca) os cartões
  // que não batem com o filtro. Um cartão "visível" (ainda no fluxo normal do layout, não
  // display:none/dimensão zero) é, portanto, um cartão da região — sem precisar detectar cor
  // ou ler texto de etiqueta.
  function isCardVisible(card) {
    return !!(card.offsetParent || (card.getClientRects && card.getClientRects().length > 0));
  }

  // Usada tanto na Etapa 2 (listar) quanto na Etapa 6 (atualizar), para que as duas etapas
  // enxerguem exatamente o mesmo conjunto de cartões da região.
  async function getFilteredCards(listEl, labelText, corHint) {
    const targetNormalized = normalizeText(labelText || 'rio claro');
    const cards = getCardsFromList(listEl);
    let usedDeepScan = false;

    // Preferência 1: filtro nativo do Trello (via URL) já escondeu os cartões que não têm a
    // etiqueta — só ler quais estão visíveis.
    let matchedCards = cards.filter(isCardVisible);

    // Se "todos" ou "nenhum" cartão está visível, o filtro nativo provavelmente não foi
    // aplicado (aba aberta sem o parâmetro, ou Trello mudou de comportamento) — cai para a
    // detecção por cor/texto de etiqueta, como nas versões anteriores.
    if (cards.length > 0 && (matchedCards.length === 0 || matchedCards.length === cards.length)) {
      matchedCards = cards.filter((c) => isTargetLabelCard(c, targetNormalized, corHint));
    }

    if (matchedCards.length === 0 && cards.length > 0) {
      // Antes de abrir cartão por cartão, tenta o atalho nativo do Trello que mostra o nome
      // das etiquetas na frente de todos os cartões (tecla "L" com o board em foco). Se o
      // Trello aceitar o evento sintético, os cartões passam a ter texto legível e a
      // verificação lenta deixa de ser necessária; se não aceitar (alguns apps ignoram
      // eventos de teclado não confiáveis), simplesmente não muda nada e segue pro fallback.
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', code: 'KeyL', keyCode: 76, which: 76, bubbles: true }));
      await new Promise((r) => setTimeout(r, 300));
      matchedCards = cards.filter((c) => isTargetLabelCard(c, targetNormalized, corHint));
    }

    if (matchedCards.length === 0 && cards.length > 0) {
      usedDeepScan = true;
      matchedCards = await filterTargetLabelDeep(cards, targetNormalized, corHint);
    }
    return { cards, matchedCards, usedDeepScan };
  }

  // ---------------------------------------------------------------------
  // Etapa 2 — listar fornecedores
  // ---------------------------------------------------------------------
  async function listarFornecedores(labelText, corHint, manterOrdemOriginal) {
    const listEl = await waitFor(findListElement, { timeout: 8000 });
    if (!listEl) {
      return { error: 'Lista de pedidos não encontrada no Trello. Verifique se o board carregou totalmente.' };
    }

    await waitFor(() => {
      const found = getCardsFromList(listEl);
      return found.length > 0 ? found : null;
    }, { timeout: 5000 });

    const { cards, matchedCards, usedDeepScan } = await getFilteredCards(listEl, labelText, corHint);

    const seen = new Set();
    const suppliers = [];
    matchedCards.forEach((card) => {
      const nome = getCardName(card);
      if (!nome) return;
      const key = normalizeText(nome);
      if (seen.has(key)) return;
      seen.add(key);
      suppliers.push({ nome });
    });

    // Regiões como Araras pedem explicitamente pra NÃO ordenar — só ler os cartões na ordem
    // em que o filtro nativo já os mostra (ver prompts-referencia/4-pedido-araras-enviar.txt).
    if (!manterOrdemOriginal) {
      suppliers.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }

    return {
      suppliers,
      diagnostics: {
        cardsRead: cards.length,
        rioClaroCards: matchedCards.length,
        usedDeepScan
      }
    };
  }

  // ---------------------------------------------------------------------
  // Etapa 6 — atualizar cartão do fornecedor selecionado
  // Conforme prompts-referencia/3-trello-atualizar.txt: renomeia o cartão, preenche datas de
  // envio/entrega, adiciona a etiqueta "Enviado", move pro topo da lista de enviados e deixa
  // o cartão aberto pra usuária anexar manualmente (a extensão nunca anexa nada sozinha).
  // ---------------------------------------------------------------------
  function formatDescricao(items) {
    const timestamp = new Date().toLocaleString('pt-BR');
    const linhas = items.map((it) => `${it.codigo} | ${it.descricao} | ${it.quantidade}`);
    return `Total: ${items.length} itens\n${linhas.join('\n')}\n[Atualizado em ${timestamp}]`;
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

  // Renomeia o cartão (padrão "FORNECEDOR NUMEROMCR", ex: "ROMPLAS 6055MCR" — ver
  // prompts-referencia/3-trello-atualizar.txt). O título fica editável clicando nele, virando
  // um <textarea>; confirma com Enter e blur (não há um botão "Salvar" dedicado no Trello
  // pra título de cartão).
  async function renameCard(newName) {
    if (!newName) return true; // nada pra fazer não é erro
    let titleEl = document.querySelector(
      '[data-testid="card-name-textarea"], textarea[data-testid="card-detail-title-input"]'
    );
    if (!titleEl) {
      const titleDisplay = document.querySelector(
        '[data-testid="card-detail-title"], [data-testid="card-name"], h2[class*="title"], h1[class*="title"]'
      );
      if (titleDisplay) {
        titleDisplay.click();
        await new Promise((r) => setTimeout(r, 200));
        titleEl = document.querySelector(
          '[data-testid="card-name-textarea"], textarea[data-testid="card-detail-title-input"]'
        );
      }
    }
    if (!titleEl) return false;

    titleEl.focus();
    if ('select' in titleEl) titleEl.select();
    titleEl.value = newName;
    titleEl.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 100));
    titleEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    titleEl.dispatchEvent(new Event('change', { bubbles: true }));
    titleEl.blur();
    await new Promise((r) => setTimeout(r, 200));
    return true;
  }

  function clickButtonByText(root, texts) {
    const normalizedTexts = texts.map((t) => normalizeText(t));
    const candidates = root.querySelectorAll('button, [role="button"]');
    for (const el of candidates) {
      if (normalizedTexts.includes(normalizeText(el.textContent || ''))) {
        el.click();
        return el;
      }
    }
    return null;
  }

  function setNativeInputValue(input, value) {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Converte "yyyy-mm-dd" (o que um <input type="date"> da sidebar produz) para "dd/mm/aaaa"
  // (formato que os campos de data do Trello em pt-BR normalmente aceitam digitado).
  function toBrDate(isoDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || '');
    if (!m) return isoDate || '';
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  // Abre o popover "Datas" do painel do cartão e preenche início (data de envio) e vencimento
  // (data de entrega). Interação especulativa (não testada contra o Trello real ainda) — ver
  // aviso em TESTES.md. Se os seletores não baterem, retorna false sem travar o resto do fluxo.
  async function setCardDates(dataEnvio, dataEntrega) {
    if (!dataEnvio && !dataEntrega) return true; // nada a fazer não é erro

    let btn = document.querySelector('[data-testid="dates-added-button"], [data-testid="dates-button"]');
    if (!btn) btn = clickButtonByText(document, ['Datas', 'Dates']);
    else btn.click();
    if (!btn) return false;

    const popover = await waitFor(
      () => document.querySelector('[data-testid="dates-popover"], [role="dialog"]'),
      { timeout: 3000 }
    );
    if (!popover) return false;

    let ok = true;
    if (dataEnvio) {
      const startInput =
        popover.querySelector('[data-testid="start-date-field"] input, [data-testid="start-date-input"]') ||
        Array.from(popover.querySelectorAll('label, [class*="field"]'))
          .find((g) => ['data de inicio', 'start date'].some((l) => normalizeText(g.textContent || '').includes(l)))
          ?.querySelector('input');
      if (startInput) setNativeInputValue(startInput, toBrDate(dataEnvio));
      else ok = false;
    }
    if (dataEntrega) {
      const dueInput =
        popover.querySelector('[data-testid="due-date-field"] input, [data-testid="due-date-input"]') ||
        Array.from(popover.querySelectorAll('label, [class*="field"]'))
          .find((g) => ['data de entrega', 'due date', 'vencimento'].some((l) => normalizeText(g.textContent || '').includes(l)))
          ?.querySelector('input');
      if (dueInput) setNativeInputValue(dueInput, toBrDate(dataEntrega));
      else ok = false;
    }

    await new Promise((r) => setTimeout(r, 150));
    const saveBtn = clickButtonByText(popover, ['Salvar', 'Save']);
    if (!saveBtn) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    return ok;
  }

  // Abre o popover "Etiquetas" do painel do cartão e marca a etiqueta cujo texto bate com
  // labelText (ex: "Enviado"). Casa só pelo texto, não pela cor — mesma limitação já conhecida
  // da detecção de cor em outras partes do código (ver TESTES.md). Interação especulativa,
  // ver aviso em TESTES.md.
  async function addLabelToCard(labelText) {
    if (!labelText) return true;
    let btn = document.querySelector('[data-testid="labels-added-button"], [data-testid="labels-button"]');
    if (!btn) btn = clickButtonByText(document, ['Etiquetas', 'Labels']);
    else btn.click();
    if (!btn) return false;

    const popover = await waitFor(
      () => document.querySelector('[data-testid="labels-popover"], [role="dialog"]'),
      { timeout: 3000 }
    );
    if (!popover) return false;

    const targetNormalized = normalizeText(labelText);
    const items = popover.querySelectorAll('[data-testid="label-checkbox"], [role="checkbox"], li, [class*="label"]');
    let found = null;
    for (const el of items) {
      const text = normalizeText(el.textContent || el.getAttribute('aria-label') || '');
      if (text.includes(targetNormalized)) { found = el; break; }
    }
    if (!found) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return false;
    }
    const alreadyChecked = found.getAttribute('aria-checked') === 'true' || !!found.querySelector('[aria-checked="true"]');
    if (!alreadyChecked) found.click();
    await new Promise((r) => setTimeout(r, 200));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
    return true;
  }

  // Abre o popover "Mover cartão" (clicando no nome da lista atual, no topo do painel do
  // cartão), escolhe a lista de destino e posição "Topo". Interação especulativa, ver aviso
  // em TESTES.md.
  async function moveCardToListTop(targetListName) {
    if (!targetListName) return true;

    let trigger = document.querySelector('[data-testid="list-name-button"], [data-testid="card-detail-list-button"]');
    if (!trigger) {
      trigger = Array.from(document.querySelectorAll('button, [role="button"]')).find((b) => {
        const t = normalizeText(b.textContent || '');
        return t.includes('pedidos') && t.includes('pendentes');
      });
    }
    if (!trigger) return false;
    trigger.click();

    const popover = await waitFor(
      () => document.querySelector('[data-testid="move-card-popover"], [role="dialog"]'),
      { timeout: 3000 }
    );
    if (!popover) return false;

    const targetNormalized = normalizeText(targetListName);
    let listChanged = false;

    const listSelect = popover.querySelector('select[data-testid="list-select"], select');
    if (listSelect) {
      const option = Array.from(listSelect.options).find((o) => normalizeText(o.textContent || '') === targetNormalized);
      if (option) {
        listSelect.value = option.value;
        listSelect.dispatchEvent(new Event('change', { bubbles: true }));
        listChanged = true;
      }
    } else {
      const listBtn = Array.from(popover.querySelectorAll('button, [role="button"]')).find((b) =>
        normalizeText(b.textContent || '').includes('lista')
      );
      if (listBtn) {
        listBtn.click();
        await new Promise((r) => setTimeout(r, 200));
        const option = Array.from(document.querySelectorAll('[role="option"], li, button')).find(
          (o) => normalizeText(o.textContent || '') === targetNormalized
        );
        if (option) {
          option.click();
          listChanged = true;
        }
      }
    }

    if (!listChanged) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return false;
    }
    await new Promise((r) => setTimeout(r, 200));

    const posSelect = popover.querySelector('select[data-testid="position-select"], select:nth-of-type(2)');
    if (posSelect) {
      const topOption = Array.from(posSelect.options).find((o) => ['topo', 'top'].includes(normalizeText(o.textContent || '')));
      if (topOption) {
        posSelect.value = topOption.value;
        posSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    await new Promise((r) => setTimeout(r, 150));

    const moveBtn = clickButtonByText(popover, ['Mover', 'Move']);
    if (!moveBtn) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    return true;
  }

  function closeCard() {
    const closeBtn = document.querySelector('[data-testid="popover-close"], button[aria-label="Close"], button[aria-label="Fechar"]');
    if (closeBtn) closeBtn.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }

  async function atualizarFornecedor(supplierName, items, opts) {
    const { labelText, corHint, numeroPedido, dataEnvio, dataEntrega, listaEnviados } = opts || {};

    const listEl = await waitFor(findListElement, { timeout: 8000 });
    if (!listEl) {
      return { error: 'Lista de pedidos não encontrada no Trello.' };
    }

    const { matchedCards } = await getFilteredCards(listEl, labelText, corHint);
    const targetKey = normalizeText(supplierName);
    const matches = matchedCards.filter((card) => normalizeText(getCardName(card)) === targetKey);

    if (matches.length === 0) {
      return { results: [{ card: supplierName, status: 'não encontrado' }] };
    }

    const descricao = formatDescricao(items);
    const novoNome = numeroPedido ? `${supplierName} ${numeroPedido}MCR` : supplierName;
    const results = [];
    let jaAtualizado = false;
    let pronto = false;

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

        const passos = {};
        passos.descricao = await writeDescription(descricao);
        passos.nome = await renameCard(novoNome);
        passos.datas = await setCardDates(dataEnvio, dataEntrega);
        passos.etiqueta = await addLabelToCard('Enviado');
        passos.movido = await moveCardToListTop(listaEnviados);
        // Não fecha o cartão de propósito: fica aberto pra usuária anexar o documento
        // manualmente (ver prompts-referencia/3-trello-atualizar.txt — "abrir para
        // adicionar o anexo e fim").

        const todosOk = Object.values(passos).every(Boolean);
        results.push({
          card: supplierName,
          status: todosOk ? 'atualizado' : 'erro',
          detalhe: todosOk ? undefined : `Passos: ${JSON.stringify(passos)}`
        });
        jaAtualizado = true;
        pronto = todosOk;
      } catch (e) {
        results.push({ card: supplierName, status: 'erro', detalhe: e.message });
      }
    }

    return { results, pronto };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SCAN_TRELLO') {
      const { labelText, corHint, manterOrdemOriginal } = request.payload || {};
      listarFornecedores(labelText, corHint, manterOrdemOriginal)
        .then(sendResponse)
        .catch((e) => sendResponse({ error: e.message }));
      return true;
    }
    if (request.type === 'UPDATE_TRELLO') {
      const { supplier, items, labelText, corHint, numeroPedido, dataEnvio, dataEntrega, listaEnviados } = request.payload || {};
      atualizarFornecedor(supplier && supplier.nome, items || [], {
        labelText,
        corHint,
        numeroPedido,
        dataEnvio,
        dataEntrega,
        listaEnviados
      })
        .then(sendResponse)
        .catch((e) => sendResponse({ error: e.message }));
      return true;
    }
    return false;
  });
})();
