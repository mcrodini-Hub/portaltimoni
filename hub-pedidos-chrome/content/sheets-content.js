// Content script do Google Sheets — Etapa 5 da especificação.
// Só lê o DOM visível da aba ativa. Nunca usa fetch(), Google Sheets API, eval, OCR,
// nem escreve na planilha (nenhum evento de edição é disparado).

(function () {
  const { detectColumns } = self.HubValidators;

  function waitFor(conditionFn, { timeout = 6000, interval = 250 } = {}) {
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

      const observer = new MutationObserver(() => tryNow());
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

  // Agrupa as células visíveis por linha, usando aria-rowindex quando disponível.
  function readGridRows() {
    const cells = document.querySelectorAll('[role="gridcell"]');
    if (!cells || cells.length === 0) return null;

    const rowsMap = new Map();
    cells.forEach((cell) => {
      const rowIndex = cell.getAttribute('aria-rowindex') || cell.closest('[role="row"]')?.getAttribute('aria-rowindex');
      const key = rowIndex !== null && rowIndex !== undefined ? Number(rowIndex) : cell.getBoundingClientRect().top;
      if (!rowsMap.has(key)) rowsMap.set(key, []);
      rowsMap.get(key).push((cell.textContent || '').trim());
    });

    const orderedKeys = Array.from(rowsMap.keys()).sort((a, b) => a - b);
    return orderedKeys.map((k) => rowsMap.get(k));
  }

  // Alternativa: tabela HTML simples (algumas visualizações do Sheets renderizam <tr>/<td>).
  function readTableRows() {
    const trs = document.querySelectorAll('tr');
    if (!trs || trs.length === 0) return null;
    return Array.from(trs).map((tr) =>
      Array.from(tr.querySelectorAll('td, th, [role="gridcell"]')).map((c) => (c.textContent || '').trim())
    );
  }

  function firstNonEmptyRowIndex(rows) {
    return rows.findIndex((row) => row.some((cell) => cell && cell.trim().length > 0));
  }

  async function extrairItens() {
    if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(window.location.href)) {
      return { error: 'A aba ativa não é uma planilha do Google Sheets.' };
    }

    let rows = await waitFor(readGridRows, { timeout: 6000 });
    if (!rows || rows.length === 0) {
      rows = readTableRows();
    }

    if (!rows || rows.length < 2) {
      return { error: 'Não foi possível ler dados visíveis na planilha. Verifique se ela carregou e role a tela se necessário.' };
    }

    const headerIdx = firstNonEmptyRowIndex(rows);
    if (headerIdx === -1) {
      return { error: 'Planilha parece vazia — nenhuma linha com dados foi encontrada.' };
    }
    const header = rows[headerIdx];

    const columns = detectColumns(header);
    if (!columns) {
      return { error: 'Não foi possível identificar automaticamente as colunas de código, descrição e quantidade. Confira o cabeçalho da planilha.' };
    }

    const items = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const codigo = (row[columns.idxCodigo] || '').trim();
      const descricao = (row[columns.idxDescricao] || '').trim();
      const quantidade = (row[columns.idxQuantidade] || '').trim();
      if (!codigo && !descricao) continue; // linha vazia
      if (!codigo || !descricao) continue; // linha incompleta, ignora
      items.push({ codigo, descricao, quantidade });
    }

    if (items.length === 0) {
      return { error: 'Nenhum item válido encontrado nas linhas da planilha.' };
    }

    return { items, diagnostics: { itemsExtracted: items.length } };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_ITEMS') {
      extrairItens().then(sendResponse).catch((e) => sendResponse({ error: e.message }));
      return true;
    }
    return false;
  });
})();
