// Content script do Google Sheets — Etapa 5 da especificação.
// Só lê o DOM visível da aba ativa. Nunca usa fetch(), Google Sheets API, eval, OCR,
// nem escreve na planilha (nenhum evento de edição é disparado).

(function () {
  const { detectColumns } = self.HubValidators;

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

    const hasRowAncestor = Array.from(cells).some((c) => c.closest('[role="row"]'));

    const rowsMap = new Map();
    const order = [];
    cells.forEach((cell) => {
      const rowEl = hasRowAncestor ? cell.closest('[role="row"]') : null;
      const key = rowEl || Math.round(cell.getBoundingClientRect().top / 4) * 4;
      if (!rowsMap.has(key)) {
        rowsMap.set(key, { texts: [], top: cell.getBoundingClientRect().top });
        order.push(key);
      }
      rowsMap.get(key).texts.push((cell.textContent || '').trim());
    });

    order.sort((a, b) => rowsMap.get(a).top - rowsMap.get(b).top);
    return order.map((k) => rowsMap.get(k).texts);
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
  // (fornecedor, transportadora, avisos, funcionário...). Em vez de assumir que a primeira
  // linha não vazia é o cabeçalho, procura a primeira linha (dentre as primeiras 30) em que
  // dá para identificar as três colunas — essa é tratada como o cabeçalho real.
  function findHeaderRow(rows) {
    const limit = Math.min(rows.length, 30);
    for (let i = 0; i < limit; i++) {
      const columns = detectColumns(rows[i]);
      if (columns) return { headerIdx: i, columns };
    }
    return null;
  }

  async function extrairItens() {
    if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(window.location.href)) {
      return { error: 'A aba ativa não é uma planilha do Google Sheets.' };
    }

    let rows = await waitFor(readGridRows, { timeout: 6000 });
    let usedFallbackTable = false;
    if (!rows || rows.length === 0) {
      rows = readTableRows();
      usedFallbackTable = true;
    }

    if (!rows || rows.length < 2) {
      return { error: 'Não foi possível ler dados visíveis na planilha. Verifique se ela carregou e role a tela se necessário.' };
    }

    const found = findHeaderRow(rows);
    if (!found) {
      return {
        error: 'Não foi possível identificar automaticamente as colunas de código, descrição e quantidade em nenhuma das primeiras linhas. Confira o cabeçalho da planilha.',
        diagnostics: {
          rowsRead: rows.length,
          usedFallbackTable,
          rowsPreview: summarizeRowsForDiagnostics(rows)
        }
      };
    }
    const { headerIdx, columns } = found;

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
