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
    UNIDADE: 'estoqueUnidade',
    WEBAPP_URL: 'estoqueWebAppUrl',
    PRODUTOS_CACHE: 'estoqueProdutosCache',
    NECESSIDADES: 'estoqueNecessidadesLocal',
    NOTIFICACOES: 'estoqueNotificacoes'
  });

  const ROLES = Object.freeze({ BALCAO: 'balcao', ESTOQUE: 'estoque', ACOMPANHAMENTO: 'acompanhamento' });

  // Unidades (lojas). 'todas' só vale para a gestão geral, que enxerga as duas.
  const UNIDADES = Object.freeze({ RIO_CLARO: 'rio_claro', ARARAS: 'araras', TODAS: 'todas' });
  const UNIDADE_LABEL = Object.freeze({ rio_claro: 'Rio Claro', araras: 'Araras', todas: 'geral' });

  // Gestão geral (acompanhamento + todas) age; gerência de unidade (acompanhamento + 1 loja)
  // é só leitura. Balcão e estoque sempre agem, dentro da sua unidade.
  function podeAgir(papel, unidade) {
    if (papel === ROLES.ACOMPANHAMENTO) return unidade === UNIDADES.TODAS;
    return true;
  }

  const STATUS = Object.freeze({
    PENDENTE: 'pendente',
    EM_COMPRA: 'em_compra',
    PEDIDO_EXISTENTE: 'pedido_existente',
    OBSERVACAO: 'observacao'
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
    if (role !== ROLES.BALCAO && role !== ROLES.ESTOQUE && role !== ROLES.ACOMPANHAMENTO) {
      throw new Error(`Papel inválido: ${role}`);
    }
    return set(KEYS.ROLE, role);
  }

  async function getUnidade() { return get(KEYS.UNIDADE, UNIDADES.RIO_CLARO); }
  async function setUnidade(unidade) {
    if (unidade !== UNIDADES.RIO_CLARO && unidade !== UNIDADES.ARARAS && unidade !== UNIDADES.TODAS) {
      throw new Error(`Unidade inválida: ${unidade}`);
    }
    return set(KEYS.UNIDADE, unidade);
  }

  async function getNotificacoes() { return get(KEYS.NOTIFICACOES, false); }
  async function setNotificacoes(ativo) { return set(KEYS.NOTIFICACOES, !!ativo); }

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
  // Cache curto em memória da fila de necessidades. Seleção de produto, recarga por foco e
  // polling costumam pedir a fila em rajada; sem isso, cada um faria uma ida à planilha. O TTL
  // é baixo (poucos segundos) e qualquer escrita invalida o cache, então os dados seguem
  // frescos. É por contexto (a sidebar tem o seu; o background, o dele).
  let necCache = null; // { data, ts }
  const NEC_TTL_MS = 3000;

  function invalidarNecessidades() { necCache = null; }

  async function getNecessidades(opts) {
    const forcar = opts && opts.forcar;
    if (!forcar && necCache && (Date.now() - necCache.ts) < NEC_TTL_MS) {
      return necCache.data;
    }
    let data;
    if (await isRemote()) {
      const r = await apiGet({ action: 'necessidades' });
      data = r.necessidades || [];
    } else {
      data = await get(KEYS.NECESSIDADES, []);
    }
    necCache = { data, ts: Date.now() };
    return data;
  }

  function generateId() {
    return `nec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async function criarNecessidade(produto, opts) {
    if (!produto || !produto.codigo) throw new Error('Selecione um produto antes de informar a necessidade.');
    invalidarNecessidades();
    const querCliente = !!(opts && opts.clienteAguardando);
    const unidade = (opts && opts.unidade) || UNIDADES.RIO_CLARO;

    if (await isRemote()) {
      const data = await apiGet({ action: 'criar', codigo: produto.codigo, cliente: querCliente ? '1' : '0', unidade });
      return data.necessidade;
    }

    // Modo local. Dedup por produto + unidade (mesmo item em lojas diferentes são pedidos distintos).
    const necessidades = await get(KEYS.NECESSIDADES, []);
    const jaPendente = necessidades.find((n) => n.codigo === produto.codigo && (n.unidade || UNIDADES.RIO_CLARO) === unidade && n.status === STATUS.PENDENTE);
    if (jaPendente) {
      // Se a nova solicitação marca cliente aguardando e a existente não, promove.
      if (querCliente && !jaPendente.clienteAguardando) {
        jaPendente.clienteAguardando = true;
        await set(KEYS.NECESSIDADES, necessidades);
      }
      return jaPendente;
    }
    const nova = {
      id: generateId(),
      codigo: produto.codigo,
      descricao: produto.descricao,
      status: STATUS.PENDENTE,
      unidade,
      criadoEm: new Date().toISOString(),
      respondidoEm: null,
      numeroPedido: null,
      previsaoEntrega: null,
      observacao: null,
      clienteAguardando: querCliente
    };
    necessidades.unshift(nova);
    await set(KEYS.NECESSIDADES, necessidades);
    return nova;
  }

  async function responderRecebido(id) {
    invalidarNecessidades();
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
    invalidarNecessidades();
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

  async function responderObservacao(id, { observacao }) {
    const texto = (observacao || '').trim();
    if (!texto) throw new Error('Escreva a resposta ao balcão.');
    invalidarNecessidades();
    if (await isRemote()) {
      const data = await apiGet({ action: 'observacao', id, texto });
      return data.necessidade;
    }
    const necessidades = await get(KEYS.NECESSIDADES, []);
    const alvo = necessidades.find((n) => n.id === id);
    if (!alvo) throw new Error('Necessidade não encontrada.');
    alvo.status = STATUS.OBSERVACAO;
    alvo.respondidoEm = new Date().toISOString();
    alvo.observacao = texto;
    await set(KEYS.NECESSIDADES, necessidades);
    return alvo;
  }

  root.EstoqueStore = {
    KEYS,
    ROLES,
    STATUS,
    UNIDADES,
    UNIDADE_LABEL,
    podeAgir,
    getRole,
    setRole,
    getUnidade,
    setUnidade,
    getNotificacoes,
    setNotificacoes,
    getWebAppUrl,
    setWebAppUrl,
    isRemote,
    testarConexao,
    carregarProdutos,
    buscarProdutos,
    getNecessidades,
    invalidarNecessidades,
    criarNecessidade,
    responderRecebido,
    responderPedidoExistente,
    responderObservacao
  };
})(self);
