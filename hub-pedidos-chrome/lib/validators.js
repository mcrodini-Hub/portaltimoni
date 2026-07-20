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

  // Tenta localizar as colunas de código, descrição e quantidade a partir da linha de
  // cabeçalho da planilha, usando palavras-chave. Retorna null se não conseguir identificar
  // as três colunas — quem chama deve exibir um erro claro nesse caso (regra da Etapa 5).
  //
  // "strong": palavras que só aparecem em cabeçalhos de código/quantidade de verdade.
  // "weak": palavras genéricas demais (ex.: "item" pode ser só um número de linha) — só
  // usadas se nenhuma coluna "strong" for encontrada em nenhuma coluna.
  const KEYWORDS = {
    codigo: {
      strong: ['codigo', 'código', 'cod.', 'sku', 'compra', 'referencia', 'ref.'],
      weak: ['cod', 'item']
    },
    descricao: {
      strong: ['descricao', 'descrição', 'produto', 'desc'],
      weak: []
    },
    quantidade: {
      strong: ['quantidade', 'qtd', 'qtde', 'quant'],
      weak: []
    }
  };

  function findIndexTiered(normalizedRow, keywordSet, exclude) {
    const tryTier = (list) => {
      for (let i = 0; i < normalizedRow.length; i++) {
        if (exclude && exclude.has(i)) continue;
        if (list.some((k) => normalizedRow[i].includes(k))) return i;
      }
      return -1;
    };
    const strongHit = tryTier(keywordSet.strong);
    if (strongHit !== -1) return strongHit;
    return tryTier(keywordSet.weak);
  }

  function detectColumns(headerRow) {
    if (!Array.isArray(headerRow) || headerRow.length === 0) return null;
    const normalized = headerRow.map(normalizeText);

    const used = new Set();
    const idxDescricao = findIndexTiered(normalized, KEYWORDS.descricao, used);
    if (idxDescricao !== -1) used.add(idxDescricao);

    const idxCodigo = findIndexTiered(normalized, KEYWORDS.codigo, used);
    if (idxCodigo !== -1) used.add(idxCodigo);

    // Quantidade normalmente é a última coluna preenchida (mês corrente); tenta por
    // palavra-chave primeiro e cai para a última coluna não vazia como alternativa.
    let idxQuantidade = findIndexTiered(normalized, KEYWORDS.quantidade, used);
    if (idxQuantidade === -1) {
      for (let i = normalized.length - 1; i >= 0; i--) {
        if (normalized[i] && !used.has(i)) {
          idxQuantidade = i;
          break;
        }
      }
    }

    if (idxCodigo === -1 || idxDescricao === -1 || idxQuantidade === -1) {
      return null;
    }
    if (idxCodigo === idxDescricao || idxCodigo === idxQuantidade || idxDescricao === idxQuantidade) {
      return null;
    }

    return { idxCodigo, idxDescricao, idxQuantidade };
  }

  root.HubValidators = {
    normalizeText,
    isTrelloBoardUrl,
    isSpreadsheetUrl,
    isDriveFolderUrl,
    isValidHttpUrl,
    detectColumns
  };
})(self);
