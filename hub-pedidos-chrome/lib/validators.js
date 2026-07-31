// Validadores compartilhados por background, sidebar e content scripts.

(function (root) {
  function normalizeText(str) {
    return (str || '')
      .toString()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // remove acentos
      .trim()
      .toLowerCase();
  }

  function isTrelloBoardUrl(url) {
    return typeof url === 'string' && /^https:\/\/trello\.com\/b\//.test(url);
  }

  function isSpreadsheetUrl(url) {
    return typeof url === 'string' && /^https:\/\/docs\.google\.com\/spreadsheets\//.test(url);
  }

  function isDriveFolderUrl(url) {
    return typeof url === 'string' && /^https:\/\/drive\.google\.com\//.test(url);
  }

  function isValidHttpUrl(value) {
    if (!value || typeof value !== 'string') return false;
    try {
      const parsed = new URL(value.trim());
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch (e) {
      return false;
    }
  }

  // Regra de extração das planilhas de compra:
  // - código: Código de compra / Cod / Compra / Código;
  // - descrição: Descrição do produto;
  // - quantidade: exclusivamente a coluna do mês vigente (ex.: jul26).
  // Não usa coluna genérica "Quantidade" nem a última coluna preenchida como fallback.
  function headerKey(value) {
    return normalizeText(value).replace(/[^a-z0-9]/g, '');
  }

  function currentMonthKeys(date = new Date()) {
    const shortMonths = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const longMonths = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const year4 = String(date.getFullYear());
    const year2 = year4.slice(-2);
    const month = date.getMonth();
    return [
      shortMonths[month] + year2,
      shortMonths[month] + year4,
      longMonths[month] + year2,
      longMonths[month] + year4
    ];
  }

  function findExactHeader(keys, accepted) {
    for (const target of accepted) {
      const index = keys.findIndex((key) => key === target);
      if (index !== -1) return index;
    }
    return -1;
  }

  function detectColumns(headerRow) {
    if (!Array.isArray(headerRow) || headerRow.length === 0) return null;

    const keys = headerRow.map(headerKey);
    const idxCodigo = findExactHeader(keys, [
      'codigodecompra',
      'codigocompra',
      'codcompra',
      'codigo',
      'cod',
      'compra'
    ]);
    const idxDescricao = findExactHeader(keys, [
      'descricaodoproduto',
      'descricaoproduto',
      'descricao',
      'produto'
    ]);

    const monthKeys = currentMonthKeys();
    let idxQuantidade = -1;
    for (let i = keys.length - 1; i >= 0; i--) {
      if (monthKeys.some((monthKey) => keys[i] === monthKey || keys[i].includes(monthKey))) {
        idxQuantidade = i;
        break;
      }
    }

    if (idxCodigo === -1 || idxDescricao === -1 || idxQuantidade === -1) return null;
    if (new Set([idxCodigo, idxDescricao, idxQuantidade]).size !== 3) return null;

    return {
      idxCodigo,
      idxDescricao,
      idxQuantidade,
      quantidadeCabecalho: headerRow[idxQuantidade],
      mesVigente: monthKeys[0]
    };
  }

  root.HubValidators = {
    normalizeText,
    isTrelloBoardUrl,
    isSpreadsheetUrl,
    isDriveFolderUrl,
    isValidHttpUrl,
    detectColumns,
    currentMonthKeys
  };
})(self);
