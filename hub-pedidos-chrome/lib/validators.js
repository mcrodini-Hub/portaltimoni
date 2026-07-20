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
  const KEYWORDS = {
    codigo: ['codigo', 'cod', 'código', 'cod.', 'sku', 'item'],
    descricao: ['descricao', 'descrição', 'produto', 'desc'],
    quantidade: ['quantidade', 'qtd', 'qtde', 'quant']
  };

  function detectColumns(headerRow) {
    if (!Array.isArray(headerRow) || headerRow.length === 0) return null;
    const normalized = headerRow.map(normalizeText);

    function findIndex(keywords) {
      for (let i = 0; i < normalized.length; i++) {
        if (keywords.some((k) => normalized[i].includes(k))) return i;
      }
      return -1;
    }

    const idxCodigo = findIndex(KEYWORDS.codigo);
    const idxDescricao = findIndex(KEYWORDS.descricao);
    // Quantidade normalmente é a última coluna preenchida (mês corrente); tenta por
    // palavra-chave primeiro e cai para a última coluna não vazia como alternativa.
    let idxQuantidade = findIndex(KEYWORDS.quantidade);
    if (idxQuantidade === -1) {
      for (let i = normalized.length - 1; i >= 0; i--) {
        if (normalized[i]) {
          idxQuantidade = i;
          break;
        }
      }
    }

    if (idxCodigo === -1 || idxDescricao === -1 || idxQuantidade === -1) {
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
