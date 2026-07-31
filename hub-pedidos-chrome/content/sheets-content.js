// Content script do Google Sheets — Etapa 5 da especificação.
// Só lê o DOM visível da aba ativa. Nunca usa fetch(), Google Sheets API, eval, OCR,
// nem escreve na planilha (nenhum evento de edição é disparado).

(function () {
  const { detectColumns, normalizeText, currentMonthKeys } = self.HubValidators;

  function clickByText(root, text, selector) {
    const normalized = normalizeText(text);
    const candidates = root.querySelectorAll(selector);
    for (const el of candidates) {
      if (normalizeText(el.textContent || '') === normalized) {
        el.click();
        return el;
      }
    }
    return null;
  }

  // Tenta ativar "Suporte a leitor de tela" pelo próprio menu do Google Sheets (Ferramentas >
  // Acessibilidade), só clicando interações reais de UI — nada de eval/API/fetch. É esse modo
  // que faz o Sheets desenhar a grade como elementos de texto reais no HTML (em vez de só
  // canvas), que é o único jeito da extensão conseguir ler o conteúdo sem OCR.
  //
  // Importante (descoberto testando com o usuário): esse item de menu NÃO é um toggle direto —
  // ele abre um diálogo modal "Configurações de acessibilidade" com um checkbox "Ativar a
  // compatibilidade com o leitor de tela" e um botão "OK". A tentativa inicial só clicava no
  // item do menu (abrindo o diálogo) mas nunca confirmava com "OK", então a configuração nunca
  // era salva de fato. Agora: abre o diálogo, garante que o checkbox está marcado, e clica OK.
  async function tryEnableScreenReaderSupport() {
    try {
      const toolsMenu = clickByText(document, 'Ferramentas', '[role="menuitem"]');
      if (!toolsMenu) return false;
      await new Promise((r) => setTimeout(r, 400));

      const accessMenu = clickByText(document, 'Acessibilidade', '[role="menuitem"]');
      if (!accessMenu) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return false;
      }
      await new Promise((r) => setTimeout(r, 400));

      let opener = null;
      document.querySelectorAll('[role="menuitemcheckbox"], [role="menuitem"]').forEach((el) => {
        if (opener) return;
        if (normalizeText(el.textContent || '').includes('leitor de tela')) opener = el;
      });
      if (!opener) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return false;
      }
      opener.click();

      // Espera o diálogo "Configurações de acessibilidade" aparecer.
      const dialog = await waitFor(() => document.querySelector('[role="dialog"]'), { timeout: 3000 });
      if (!dialog) return false;

      const checkbox = Array.from(
        dialog.querySelectorAll('[role="checkbox"], input[type="checkbox"]')
      ).find((el) => normalizeText(el.closest('label')?.textContent || el.parentElement?.textContent || '').includes('leitor de tela'));

      const isChecked = (el) => el.getAttribute('aria-checked') === 'true' || el.checked === true;
      if (checkbox && !isChecked(checkbox)) {
        checkbox.click();
        await new Promise((r) => setTimeout(r, 150));
      }

      const okBtn = Array.from(dialog.querySelectorAll('button')).find(
        (b) => normalizeText(b.textContent || '') === 'ok'
      );
      if (!okBtn) return false;
      okBtn.click();

      await new Promise((r) => setTimeout(r, 2000)); // Sheets redesenha a grade em modo acessível
      return true;
    } catch (e) {
      return false;
    }
  }

  function waitFor(conditionFn, { timeout = 6000, interval = 250 } = {}) {
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

      observer = new MutationObserver(() => tryNow());
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

  // Agrupa as células visíveis por linha. Estratégia principal: agrupar pelo próprio elemento
  // ancestral com role="row" (identidade do nó, não um número de atributo que pode não
  // existir ou não bater com o que é mostrado). Se não achar um ancestral role="row" para
  // NENHUMA célula, cai para agrupar por posição vertical arredondada (tolera diferenças de
  // sub-pixel entre células da mesma linha).
  function readGridRows() {
    const cells = document.querySelectorAll('[role="gridcell"]');
    if (!cells || cells.length === 0) return null;

    const hasRowAncestor = Array.from(cells).some((cell) => cell.closest('[role="row"]'));
    const rowsMap = new Map();
    const order = [];

    cells.forEach((cell) => {
      const rowEl = hasRowAncestor ? cell.closest('[role="row"]') : null;
      const key = rowEl || Math.round(cell.getBoundingClientRect().top / 4) * 4;
      if (!rowsMap.has(key)) {
        rowsMap.set(key, { cells: [], top: cell.getBoundingClientRect().top });
        order.push(key);
      }

      const ariaCol = Number(
        cell.getAttribute('aria-colindex') ||
        cell.getAttribute('data-col-index') ||
        cell.getAttribute('data-column-index')
      );
      rowsMap.get(key).cells.push({
        text: (cell.textContent || '').trim(),
        colIndex: Number.isInteger(ariaCol) && ariaCol > 0 ? ariaCol - 1 : null
      });
    });

    order.sort((a, b) => rowsMap.get(a).top - rowsMap.get(b).top);
    return order.map((key) => {
      const rowCells = rowsMap.get(key).cells;
      const hasColumnIndexes = rowCells.some((cell) => cell.colIndex !== null);
      if (!hasColumnIndexes) return rowCells.map((cell) => cell.text);

      const texts = [];
      rowCells.forEach((cell) => {
        if (cell.colIndex !== null) texts[cell.colIndex] = cell.text;
        else texts.push(cell.text);
      });
      for (let i = 0; i < texts.length; i++) {
        if (texts[i] === undefined) texts[i] = '';
      }
      return texts;
    });
  }

  // Alternativa: tabela HTML simples (algumas visualizações do Sheets renderizam <tr>/<td>).
  function readTableRows() {
    const trs = document.querySelectorAll('tr');
    if (!trs || trs.length === 0) return null;
    return Array.from(trs).map((tr) =>
      Array.from(tr.querySelectorAll('td, th, [role="gridcell"]')).map((c) => (c.textContent || '').trim())
    );
  }

  // Resumo curto das primeiras linhas lidas, usado só para diagnóstico quando a extração
  // falha — ajuda a entender rápido se a leitura do DOM está errada (linhas fragmentadas
  // demais, célula por célula) sem precisar inspecionar a planilha ao vivo.
  function summarizeRowsForDiagnostics(rows) {
    return rows.slice(0, 6).map((row) => `[${row.length} cél.] ${row.slice(0, 6).join(' | ')}`).join('\n');
  }

  // Planilhas reais costumam ter várias linhas de "ruído" antes do cabeçalho de verdade
  // (fornecedor, transportadora, avisos, funcionário...). Nas planilhas do fornecedor
  // testadas, o cabeçalho fica sempre na linha 3 (índice 2) — tenta essa linha primeiro
  // (rápido e evita falso-positivo em linhas de ruído que por acaso batam com alguma
  // palavra-chave fraca) e só cai para varrer as primeiras 30 linhas se a linha 3 não bater.
  function findHeaderRow(rows) {
    const preferredIdx = 2; // linha 3 (1-indexado)
    if (rows[preferredIdx]) {
      const columns = detectColumns(rows[preferredIdx]);
      if (columns) return { headerIdx: preferredIdx, columns };
    }
    const limit = Math.min(rows.length, 30);
    for (let i = 0; i < limit; i++) {
      const columns = detectColumns(rows[i]);
      if (columns) return { headerIdx: i, columns };
    }
    return null;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    const input = String(text || '').replace(/^\uFEFF/, '');

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      if (quoted) {
        if (char === '"' && input[i + 1] === '"') {
          field += '"';
          i++;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n') {
        row.push(field.replace(/\r$/, ''));
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }

    if (field.length > 0 || row.length > 0) {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
    }
    return rows;
  }

  function spreadsheetIdentity() {
    const match = location.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if (!match) throw new Error('ID da planilha não encontrado.');
    const url = new URL(location.href);
    const hashGid = (url.hash.match(/gid=(\d+)/) || [])[1];
    return {
      id: match[1],
      gid: url.searchParams.get('gid') || hashGid || '0'
    };
  }

  function requestCsvFromBackground(url) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'FETCH_SHEET_CSV', payload: { url }, source: 'sheets-content', timestamp: Date.now() },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message });
            return;
          }
          resolve(response || { error: 'Sem resposta ao ler a planilha.' });
        }
      );
    });
  }

  async function readCsvRows() {
    const { id, gid } = spreadsheetIdentity();
    const encodedGid = encodeURIComponent(gid);
    const urls = [
      `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${encodedGid}`,
      `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${encodedGid}`
    ];
    let lastError = 'Falha desconhecida ao ler a planilha.';

    for (const url of urls) {
      const result = await requestCsvFromBackground(url);
      if (result && result.csv) {
        const rows = parseCsv(result.csv);
        if (rows.length >= 2) return rows;
        lastError = 'A planilha retornou menos de duas linhas.';
      } else {
        lastError = (result && result.error) || lastError;
      }
    }
    throw new Error(lastError);
  }

  function extractItemsFromRows(rows, diagnostics) {
    if (!rows || rows.length < 2) {
      return { error: 'A planilha não possui linhas suficientes para extrair o pedido.' };
    }

    const found = findHeaderRow(rows);
    if (!found) {
      return {
        error: `Não foi possível identificar com segurança Código/Compra, Descrição do produto e ${currentMonthKeys()[0]}. A extração foi interrompida para evitar quantidade incorreta.`,
        diagnostics: Object.assign({}, diagnostics, {
          rowsRead: rows.length,
          rowsPreview: summarizeRowsForDiagnostics(rows)
        })
      };
    }

    const { headerIdx, columns } = found;
    const items = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const codigo = String(row[columns.idxCodigo] ?? '').trim();
      const descricao = String(row[columns.idxDescricao] ?? '').trim();
      const quantidade = String(row[columns.idxQuantidade] ?? '').trim();
      if (!codigo || !descricao || !quantidade) continue;
      items.push({ codigo, descricao, quantidade });
    }

    if (items.length === 0) {
      return {
        error: `Nenhum item com quantidade preenchida foi encontrado em ${columns.quantidadeCabecalho || columns.mesVigente}.`,
        diagnostics: Object.assign({}, diagnostics, {
          rowsRead: rows.length,
          mesVigente: columns.mesVigente,
          quantidadeCabecalho: columns.quantidadeCabecalho
        })
      };
    }

    return {
      items,
      totalItens: items.length,
      mesVigente: columns.mesVigente,
      quantidadeCabecalho: columns.quantidadeCabecalho,
      diagnostics: Object.assign({}, diagnostics, {
        rowsRead: rows.length,
        itemsExtracted: items.length,
        mesVigente: columns.mesVigente,
        quantidadeCabecalho: columns.quantidadeCabecalho
      })
    };
  }

  async function extrairItens() {
    if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(window.location.href)) {
      return { error: 'A aba ativa não é uma planilha do Google Sheets.' };
    }

    // Caminho principal: lê a aba como CSV usando a sessão Google já autenticada.
    // Não depende do canvas, da acessibilidade nem das células visíveis na tela.
    let csvError = null;
    try {
      const csvRows = await readCsvRows();
      return extractItemsFromRows(csvRows, {
        source: 'csv',
        usedFallbackTable: false,
        triedAutoEnable: false
      });
    } catch (error) {
      csvError = error;
    }

    // Fallback local, sem OCR, apenas se a leitura CSV estiver indisponível.
    let rows = await waitFor(readGridRows, { timeout: 4000 });
    let usedFallbackTable = false;
    let triedAutoEnable = false;

    if (!rows || rows.length === 0) {
      if (document.querySelectorAll('[role="gridcell"]').length === 0) {
        triedAutoEnable = await tryEnableScreenReaderSupport();
        if (triedAutoEnable) rows = await waitFor(readGridRows, { timeout: 4000 });
      }
      if (!rows || rows.length === 0) {
        rows = readTableRows();
        usedFallbackTable = true;
      }
    }

    if (!rows || rows.length === 0) {
      return {
        error: `Não foi possível ler os dados da planilha diretamente. ${csvError ? csvError.message : ''}`.trim(),
        diagnostics: {
          source: 'failed',
          rowsRead: 0,
          csvError: csvError ? csvError.message : '',
          triedAutoEnable
        }
      };
    }

    return extractItemsFromRows(rows, {
      source: 'dom-fallback',
      usedFallbackTable,
      triedAutoEnable,
      csvError: csvError ? csvError.message : ''
    });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_ITEMS') {
      extrairItens().then(sendResponse).catch((e) => sendResponse({ error: e.message }));
      return true;
    }
    return false;
  });
})();
