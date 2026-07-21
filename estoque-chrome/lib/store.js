// Persistência em chrome.storage.local para o módulo Estoque.
// Compartilhado entre sidebar.js via <script> normal (mesmo padrão do hub-pedidos-chrome).
//
// IMPORTANTE — limitação atual: chrome.storage.local é local à instalação da extensão
// (um Chrome/computador só). Balcão e Estoque(Lucas) rodando em computadores diferentes
// NÃO compartilham essas necessidades entre si enquanto a fonte de dados real (planilha)
// não for conectada — ver TODO em ensureSeed() e no README. Por enquanto isso serve para
// desenvolver e demonstrar o fluxo dos dois papéis na mesma máquina, trocando de perfil.

(function (root) {
  const KEYS = Object.freeze({
    ROLE: 'estoqueRole',
    PRODUTOS: 'estoqueProdutos',
    NECESSIDADES: 'estoqueNecessidades'
  });

  const ROLES = Object.freeze({
    BALCAO: 'balcao',
    ESTOQUE: 'estoque'
  });

  const STATUS = Object.freeze({
    PENDENTE: 'pendente',
    EM_COMPRA: 'em_compra',
    PEDIDO_EXISTENTE: 'pedido_existente'
  });

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

  async function getRole() {
    return get(KEYS.ROLE, null);
  }

  async function setRole(role) {
    if (role !== ROLES.BALCAO && role !== ROLES.ESTOQUE) {
      throw new Error(`Papel inválido: ${role}`);
    }
    return set(KEYS.ROLE, role);
  }

  // TODO: substituir pela leitura da fonte real do catálogo assim que ela for definida.
  // Por ora, semeia o mock uma única vez em storage local (permite editar/testar sem perder
  // ao recarregar a sidebar).
  async function getProdutos() {
    const stored = await get(KEYS.PRODUTOS, null);
    if (stored && stored.length > 0) return stored;
    const seeded = (root.EstoqueMockProdutos || []).slice();
    await set(KEYS.PRODUTOS, seeded);
    return seeded;
  }

  function normalize(text) {
    return (text || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  async function buscarProdutos(termo) {
    const produtos = await getProdutos();
    const alvo = normalize(termo);
    if (!alvo) return [];
    return produtos.filter((p) => normalize(p.codigo).includes(alvo) || normalize(p.descricao).includes(alvo));
  }

  async function getNecessidades() {
    return get(KEYS.NECESSIDADES, []);
  }

  function generateId() {
    return `nec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async function criarNecessidade(produto) {
    if (!produto || !produto.codigo) throw new Error('Selecione um produto antes de informar a necessidade.');
    const necessidades = await getNecessidades();

    // Evita solicitação duplicada: mesmo produto já pendente (ainda sem resposta do estoque).
    const jaPendente = necessidades.find((n) => n.codigo === produto.codigo && n.status === STATUS.PENDENTE);
    if (jaPendente) return jaPendente;

    const nova = {
      id: generateId(),
      codigo: produto.codigo,
      descricao: produto.descricao,
      status: STATUS.PENDENTE,
      criadoEm: Date.now(),
      resposta: null
    };
    necessidades.unshift(nova);
    await set(KEYS.NECESSIDADES, necessidades);
    return nova;
  }

  async function responderRecebido(id) {
    const necessidades = await getNecessidades();
    const alvo = necessidades.find((n) => n.id === id);
    if (!alvo) throw new Error('Necessidade não encontrada.');
    alvo.status = STATUS.EM_COMPRA;
    alvo.resposta = { tipo: STATUS.EM_COMPRA, respondidoEm: Date.now() };
    await set(KEYS.NECESSIDADES, necessidades);
    return alvo;
  }

  async function responderPedidoExistente(id, { numeroPedido, previsaoEntrega }) {
    if (!numeroPedido || !previsaoEntrega) {
      throw new Error('Informe o número do pedido e a previsão de entrega.');
    }
    const necessidades = await getNecessidades();
    const alvo = necessidades.find((n) => n.id === id);
    if (!alvo) throw new Error('Necessidade não encontrada.');
    alvo.status = STATUS.PEDIDO_EXISTENTE;
    alvo.resposta = {
      tipo: STATUS.PEDIDO_EXISTENTE,
      numeroPedido,
      previsaoEntrega,
      respondidoEm: Date.now()
    };
    await set(KEYS.NECESSIDADES, necessidades);
    return alvo;
  }

  root.EstoqueStore = {
    KEYS,
    ROLES,
    STATUS,
    getRole,
    setRole,
    getProdutos,
    buscarProdutos,
    getNecessidades,
    criarNecessidade,
    responderRecebido,
    responderPedidoExistente
  };
})(self);
