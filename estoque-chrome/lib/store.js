// Camada de dados do módulo Estoque.
//
// Dois modos, escolhidos automaticamente conforme haja ou não uma URL de Web App configurada:
//   • MODO PLANILHA (remoto): fala com o Apps Script publicado (ver apps-script/Codigo.gs) por
//     fetch. É o modo real — a fila de necessidades fica na planilha e é compartilhada entre
//     todos os computadores (balcão e estoque), em qualquer máquina.
//   • MODO LOCAL (fallback): sem URL configurada, tudo vive em chrome.storage.local desta
//     instalação. Serve só para testar a interface antes de publicar a planilha; NÃO é
//     compartilhado entre computadores.
//
// Compartilhado com sidebar.js via <script> normal (mesmo padrão do hub-pedidos-chrome).

(function (root) {
  const KEYS = Object.freeze({
    ROLE: 'estoqueRole',
    WEBAPP_URL: 'estoqueWebAppUrl',
    PRODUTOS_CACHE: 'estoqueProdutosCache',
    NECESSIDADES: 'estoqueNecessidadesLocal'
  });

  const ROLES = Object.freeze({ BALCAO: 'balcao', ESTOQUE: 'estoque' });

  const STATUS = Object.freeze({
    PENDENTE: 'pendente',
    EM_COMPRA: 'em_compra',
    PEDIDO_EXISTENTE: 'pedido_existente'
  });

  // -------------------------------------------------------------------------
  // chrome.storage.local helpers
  // -------------------------------------------------------------------------
  function get(key, fallback) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result && key in result ? result[key] : fallback);
      });
    });
  }

  function set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => resolve(value));
    });
  }

  // -------------------------------------------------------------------------
  // Configuração: papel do computador e URL do Web App
  // -------------------------------------------------------------------------
  async function getRole() { return get(KEYS.ROLE, null); }

  async function setRole(role) {
    if (role !== ROLES.BALCAO && role !== ROLES.ESTOQUE) {
      throw new Error(`Papel inválido: ${role}`);
    }
    return set(KEYS.ROLE, role);
  }

  async function getWebAppUrl() { return get(KEYS.WEBAPP_URL, ''); }

  async function setWebAppUrl(url) {
    const limpa = (url || '').trim();
    if (limpa && !/^https:\/\/script\.google\.com\/.*\/exec(\?.*)?$/.test(limpa)) {
      throw new Error('URL inválida. Cole a URL do Web App terminada em /exec.');
    }
    // Ao trocar de planilha, o cache de produtos antigo não vale mais.
    await set(KEYS.PRODUTOS_CACHE, null);
    return set(KEYS.WEBAPP_URL, limpa);
  }

  async function isRemote() { return !!(await getWebAppUrl()); }

  // -------------------------------------------------------------------------
  // Cliente do Web App (modo planilha)
  // -------------------------------------------------------------------------
  async function apiGet(params) {
    const base = await getWebAppUrl();
    if (!base) throw new Error('URL do Web App não configurada.');
    const qs = new URLSearchParams(params).toString();
    const url = base + (base.includes('?') ? '&' : '?') + qs;
    let res;
    try {
      res = await fetch(url, { method: 'GET', redirect: 'follow' });
    } catch (e) {
      throw new Error('Não foi possível falar com a planilha. Verifique a conexão e a URL.');
    }
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('A planilha respondeu em formato inesperado. Confira se o Web App está publicado como "Qualquer pessoa".');
    }
    if (!data || data.ok !== true) {
      throw new Error((data && data.erro) || 'Erro ao acessar a planilha.');
    }
    return data;
  }

  // Testa a conexão com o Web App; devolve { ok, erro }.
  async function testarConexao() {
    try {
      await apiGet({ action: 'produtos' });
      return { ok: true };
    } catch (e) {
      return { ok: false, erro: e.message };
    }
  }

  // -------------------------------------------------------------------------
  // Produtos (catálogo) — busca do balcão
  // -------------------------------------------------------------------------
  function normalize(text) {
    return (text || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  // Carrega o catálogo. Em modo planilha, busca do Web App e guarda em cache local (para a
  // busca ser instantânea e continuar funcionando offline). Em modo local, usa o mock.
  async function carregarProdutos(force) {
    if (await isRemote()) {
      if (!force) {
        const cache = await get(KEYS.PRODUTOS_CACHE, null);
        if (cache && cache.length > 0) return cache;
      }
      const data = await apiGet({ action: 'produtos' });
      const produtos = data.produtos || [];
      await set(KEYS.PRODUTOS_CACHE, produtos);
      return produtos;
    }
    // Modo local: mock (semeado uma vez).
    const cache = await get(KEYS.PRODUTOS_CACHE, null);
    if (cache && cache.length > 0) return cache;
    const seeded = (root.EstoqueMockProdutos || []).slice();
    await set(KEYS.PRODUTOS_CACHE, seeded);
    return seeded;
  }

  async function buscarProdutos(termo) {
    const alvo = normalize(termo);
    if (!alvo) return [];
    const produtos = await carregarProdutos(false);
    return produtos.filter((p) => normalize(p.codigo).includes(alvo) || normalize(p.descricao).includes(alvo));
  }

  // -------------------------------------------------------------------------
  // Necessidades
  // -------------------------------------------------------------------------
  async function getNecessidades() {
    if (await isRemote()) {
      const data = await apiGet({ action: 'necessidades' });
      return data.necessidades || [];
    }
    return get(KEYS.NECESSIDADES, []);
  }

  function generateId() {
    return `nec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async function criarNecessidade(produto) {
    if (!produto || !produto.codigo) throw new Error('Selecione um produto antes de informar a necessidade.');

    if (await isRemote()) {
      const data = await apiGet({ action: 'criar', codigo: produto.codigo });
      return data.necessidade;
    }

    // Modo local
    const necessidades = await get(KEYS.NECESSIDADES, []);
    const jaPendente = necessidades.find((n) => n.codigo === produto.codigo && n.status === STATUS.PENDENTE);
    if (jaPendente) return jaPendente;
    const nova = {
      id: generateId(),
      codigo: produto.codigo,
      descricao: produto.descricao,
      status: STATUS.PENDENTE,
      criadoEm: new Date().toISOString(),
      respondidoEm: null,
      numeroPedido: null,
      previsaoEntrega: null
    };
    necessidades.unshift(nova);
    await set(KEYS.NECESSIDADES, necessidades);
    return nova;
  }

  async function responderRecebido(id) {
    if (await isRemote()) {
      const data = await apiGet({ action: 'recebido', id });
      return data.necessidade;
    }
    const necessidades = await get(KEYS.NECESSIDADES, []);
    const alvo = necessidades.find((n) => n.id === id);
    if (!alvo) throw new Error('Necessidade não encontrada.');
    alvo.status = STATUS.EM_COMPRA;
    alvo.respondidoEm = new Date().toISOString();
    await set(KEYS.NECESSIDADES, necessidades);
    return alvo;
  }

  async function responderPedidoExistente(id, { numeroPedido, previsaoEntrega }) {
    if (!numeroPedido || !previsaoEntrega) {
      throw new Error('Informe o número do pedido e a previsão de entrega.');
    }
    if (await isRemote()) {
      const data = await apiGet({ action: 'pedido', id, numeroPedido, previsao: previsaoEntrega });
      return data.necessidade;
    }
    const necessidades = await get(KEYS.NECESSIDADES, []);
    const alvo = necessidades.find((n) => n.id === id);
    if (!alvo) throw new Error('Necessidade não encontrada.');
    alvo.status = STATUS.PEDIDO_EXISTENTE;
    alvo.respondidoEm = new Date().toISOString();
    alvo.numeroPedido = numeroPedido;
    alvo.previsaoEntrega = previsaoEntrega;
    await set(KEYS.NECESSIDADES, necessidades);
    return alvo;
  }

  root.EstoqueStore = {
    KEYS,
    ROLES,
    STATUS,
    getRole,
    setRole,
    getWebAppUrl,
    setWebAppUrl,
    isRemote,
    testarConexao,
    carregarProdutos,
    buscarProdutos,
    getNecessidades,
    criarNecessidade,
    responderRecebido,
    responderPedidoExistente
  };
})(self);
