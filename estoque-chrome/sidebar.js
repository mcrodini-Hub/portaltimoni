// Lógica da sidebar do módulo Estoque.
// Toda leitura/escrita passa por EstoqueStore (ver lib/store.js), que decide sozinho entre
// modo planilha (Web App do Apps Script, compartilhado) e modo local (fallback só desta
// instalação). Esta camada cuida da interface, estados de carregamento e erros.

(function () {
  const { ROLES, STATUS } = EstoqueStore;

  const el = {
    telaPapel: document.getElementById('tela-papel'),
    btnPapelBalcao: document.getElementById('btn-papel-balcao'),
    btnPapelEstoque: document.getElementById('btn-papel-estoque'),
    rolePillWrap: document.getElementById('role-pill-wrap'),
    rolePill: document.getElementById('role-pill'),
    btnTrocarPerfil: document.getElementById('btn-trocar-perfil'),
    btnConfig: document.getElementById('btn-config'),
    errorBanner: document.getElementById('error-banner'),

    telaConfig: document.getElementById('tela-config'),
    inputWebappUrl: document.getElementById('input-webapp-url'),
    btnSalvarConfig: document.getElementById('btn-salvar-config'),
    btnFecharConfig: document.getElementById('btn-fechar-config'),
    configStatus: document.getElementById('config-status'),
    connStatusBalcao: document.getElementById('conn-status-balcao'),
    connStatusEstoque: document.getElementById('conn-status-estoque'),

    viewBalcao: document.getElementById('view-balcao'),
    inputBusca: document.getElementById('input-busca'),
    listaResultados: document.getElementById('lista-resultados'),
    buscaVazio: document.getElementById('busca-vazio'),
    produtoSelecionadoWrap: document.getElementById('produto-selecionado-wrap'),
    selCodigo: document.getElementById('sel-codigo'),
    selDescricao: document.getElementById('sel-descricao'),
    btnInformarNecessidade: document.getElementById('btn-informar-necessidade'),
    solicitacoesVazio: document.getElementById('solicitacoes-vazio'),
    listaSolicitacoes: document.getElementById('lista-solicitacoes'),

    viewEstoque: document.getElementById('view-estoque'),
    pendentesCount: document.getElementById('pendentes-count'),
    pendentesVazio: document.getElementById('pendentes-vazio'),
    listaPendentes: document.getElementById('lista-pendentes'),
    compraVazio: document.getElementById('compra-vazio'),
    listaCompra: document.getElementById('lista-compra')
  };

  let produtoSelecionado = null;
  let roleAtual = null;
  let pollTimer = null;

  function showError(msg) {
    el.errorBanner.hidden = !msg;
    el.errorBanner.textContent = msg || '';
  }

  function formatDateTime(valor) {
    if (!valor) return '--';
    const d = new Date(valor);
    return isNaN(d.getTime()) ? String(valor) : d.toLocaleString('pt-BR');
  }

  // previsaoEntrega é guardada como AAAA-MM-DD; exibe como DD/MM/AAAA.
  function formatDateOnly(valor) {
    if (!valor) return '--';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor));
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    const d = new Date(valor);
    return isNaN(d.getTime()) ? String(valor) : d.toLocaleDateString('pt-BR');
  }

  function ordenarPorCriadoDesc(lista) {
    return lista.slice().sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
  }

  // ---------------------------------------------------------------------
  // Status de conexão (planilha x local)
  // ---------------------------------------------------------------------
  async function atualizarStatusConexao() {
    const remoto = await EstoqueStore.isRemote();
    const texto = remoto ? 'Conectado à planilha compartilhada.' : 'Modo local — dados só neste computador (configure a planilha em ⚙).';
    const classe = remoto ? 'remote' : 'local';
    [el.connStatusBalcao, el.connStatusEstoque].forEach((node) => {
      node.textContent = texto;
      node.className = `conn-status ${classe}`;
    });
  }

  // ---------------------------------------------------------------------
  // Painel de configuração da planilha
  // ---------------------------------------------------------------------
  el.btnConfig.addEventListener('click', async () => {
    el.telaConfig.hidden = !el.telaConfig.hidden;
    if (!el.telaConfig.hidden) {
      el.inputWebappUrl.value = await EstoqueStore.getWebAppUrl();
      el.configStatus.textContent = '';
      el.configStatus.className = 'hint-text';
    }
  });

  el.btnFecharConfig.addEventListener('click', () => { el.telaConfig.hidden = true; });

  el.btnSalvarConfig.addEventListener('click', async () => {
    el.configStatus.className = 'hint-text';
    el.configStatus.textContent = 'Salvando e testando...';
    try {
      await EstoqueStore.setWebAppUrl(el.inputWebappUrl.value);
    } catch (e) {
      el.configStatus.textContent = e.message;
      el.configStatus.className = 'conn-status erro';
      return;
    }
    if (await EstoqueStore.isRemote()) {
      const teste = await EstoqueStore.testarConexao();
      if (!teste.ok) {
        el.configStatus.textContent = `Não conectou: ${teste.erro}`;
        el.configStatus.className = 'conn-status erro';
        return;
      }
      el.configStatus.textContent = 'Conectado! Planilha compartilhada ativa.';
      el.configStatus.className = 'conn-status remote';
    } else {
      el.configStatus.textContent = 'URL removida — voltou para o modo local.';
      el.configStatus.className = 'conn-status local';
    }
    await atualizarStatusConexao();
    await recarregarVisaoAtual();
    iniciarPolling();
  });

  // ---------------------------------------------------------------------
  // Papel do computador (Balcão / Estoque)
  // ---------------------------------------------------------------------
  async function initRole() {
    await atualizarStatusConexao();
    const role = await EstoqueStore.getRole();
    if (!role) {
      el.telaPapel.hidden = false;
      return;
    }
    applyRole(role);
  }

  async function applyRole(role) {
    roleAtual = role;
    el.telaPapel.hidden = true;
    el.rolePillWrap.hidden = false;
    el.rolePill.textContent = role === ROLES.BALCAO ? 'Balcão' : 'Estoque (Lucas)';
    el.viewBalcao.hidden = role !== ROLES.BALCAO;
    el.viewEstoque.hidden = role !== ROLES.ESTOQUE;
    await atualizarStatusConexao();
    await recarregarVisaoAtual();
    iniciarPolling();
  }

  el.btnPapelBalcao.addEventListener('click', async () => {
    await EstoqueStore.setRole(ROLES.BALCAO);
    applyRole(ROLES.BALCAO);
  });

  el.btnPapelEstoque.addEventListener('click', async () => {
    await EstoqueStore.setRole(ROLES.ESTOQUE);
    applyRole(ROLES.ESTOQUE);
  });

  el.btnTrocarPerfil.addEventListener('click', () => {
    pararPolling();
    roleAtual = null;
    el.telaPapel.hidden = false;
    el.rolePillWrap.hidden = true;
    el.viewBalcao.hidden = true;
    el.viewEstoque.hidden = true;
  });

  // ---------------------------------------------------------------------
  // Recarga / polling
  // ---------------------------------------------------------------------
  async function recarregarVisaoAtual() {
    if (roleAtual === ROLES.BALCAO) await renderSolicitacoes();
    else if (roleAtual === ROLES.ESTOQUE) await renderFilaEstoque();
  }

  function iniciarPolling() {
    pararPolling();
    // Em modo planilha, atualiza periodicamente para ver mudanças feitas em outros
    // computadores (não há push; é polling leve). Em modo local não há o que sincronizar.
    EstoqueStore.isRemote().then((remoto) => {
      if (remoto) pollTimer = setInterval(recarregarVisaoAtual, 15000);
    });
  }

  function pararPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  document.querySelectorAll('.js-atualizar').forEach((btn) => {
    btn.addEventListener('click', async () => {
      showError(null);
      try {
        await EstoqueStore.carregarProdutos(true); // força recarga do catálogo
        await recarregarVisaoAtual();
      } catch (e) {
        showError(e.message);
      }
    });
  });

  // ---------------------------------------------------------------------
  // Visão Balcão — Módulo 1
  // ---------------------------------------------------------------------
  let buscaTimer = null;
  el.inputBusca.addEventListener('input', () => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(() => executarBusca(el.inputBusca.value), 200);
  });

  async function executarBusca(termo) {
    el.listaResultados.innerHTML = '';
    if (!termo.trim()) {
      el.listaResultados.hidden = true;
      el.buscaVazio.hidden = true;
      return;
    }

    let resultados;
    try {
      resultados = await EstoqueStore.buscarProdutos(termo);
    } catch (e) {
      showError(e.message);
      return;
    }

    if (resultados.length === 0) {
      el.listaResultados.hidden = true;
      el.buscaVazio.hidden = false;
      return;
    }

    el.buscaVazio.hidden = true;
    el.listaResultados.hidden = false;
    resultados.forEach((produto) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="codigo"></span><span class="desc"></span>`;
      li.querySelector('.codigo').textContent = produto.codigo;
      li.querySelector('.desc').textContent = produto.descricao;
      li.addEventListener('click', () => selecionarProduto(produto));
      el.listaResultados.appendChild(li);
    });
  }

  function selecionarProduto(produto) {
    produtoSelecionado = produto;
    el.selCodigo.textContent = produto.codigo;
    el.selDescricao.textContent = produto.descricao;
    el.produtoSelecionadoWrap.hidden = false;
    showError(null);
  }

  el.btnInformarNecessidade.addEventListener('click', async () => {
    if (!produtoSelecionado) return;
    el.btnInformarNecessidade.disabled = true;
    try {
      await EstoqueStore.criarNecessidade(produtoSelecionado);
      showError(null);
      produtoSelecionado = null;
      el.produtoSelecionadoWrap.hidden = true;
      el.inputBusca.value = '';
      el.listaResultados.hidden = true;
      await renderSolicitacoes();
    } catch (e) {
      showError(e.message);
    } finally {
      el.btnInformarNecessidade.disabled = false;
    }
  });

  function statusLabel(n) {
    if (n.status === STATUS.PENDENTE) return 'Aguardando resposta do estoque';
    if (n.status === STATUS.EM_COMPRA) return 'Recebido — providenciando pedido de compra';
    if (n.status === STATUS.PEDIDO_EXISTENTE) {
      return `O produto já consta no Pedido ${n.numeroPedido} — Previsão de entrega: ${formatDateOnly(n.previsaoEntrega)}`;
    }
    return '';
  }

  async function renderSolicitacoes() {
    let necessidades;
    try {
      necessidades = ordenarPorCriadoDesc(await EstoqueStore.getNecessidades());
    } catch (e) {
      showError(e.message);
      return;
    }
    el.listaSolicitacoes.innerHTML = '';
    el.solicitacoesVazio.hidden = necessidades.length > 0;

    necessidades.forEach((n) => {
      const li = document.createElement('li');
      li.className = `status-${n.status}`;
      const linha1 = document.createElement('div');
      const cod = document.createElement('span');
      cod.className = 'item-codigo';
      cod.textContent = n.codigo;
      const desc = document.createElement('span');
      desc.className = 'item-desc';
      desc.textContent = n.descricao;
      linha1.append(cod, desc);
      const linha2 = document.createElement('div');
      linha2.className = 'status-line';
      linha2.textContent = statusLabel(n);
      li.append(linha1, linha2);
      el.listaSolicitacoes.appendChild(li);
    });
  }

  // ---------------------------------------------------------------------
  // Visão Estoque (Lucas) — Módulo 2
  // ---------------------------------------------------------------------
  async function renderFilaEstoque() {
    let necessidades;
    try {
      necessidades = await EstoqueStore.getNecessidades();
    } catch (e) {
      showError(e.message);
      return;
    }
    const pendentes = ordenarPorCriadoDesc(necessidades.filter((n) => n.status === STATUS.PENDENTE));
    const emCompra = ordenarPorCriadoDesc(necessidades.filter((n) => n.status === STATUS.EM_COMPRA));

    el.pendentesCount.textContent = String(pendentes.length);
    el.listaPendentes.innerHTML = '';
    el.pendentesVazio.hidden = pendentes.length > 0;

    pendentes.forEach((n) => {
      const li = document.createElement('li');
      const cod = document.createElement('span');
      cod.className = 'item-codigo';
      cod.textContent = n.codigo;
      const desc = document.createElement('span');
      desc.className = 'item-desc';
      desc.textContent = n.descricao;
      const meta = document.createElement('p');
      meta.className = 'hint-text';
      meta.style.margin = '4px 0 0';
      meta.textContent = `Solicitado em ${formatDateTime(n.criadoEm)}`;

      const acoes = document.createElement('div');
      acoes.className = 'need-actions';
      acoes.innerHTML = `
        <button class="btn btn-primary btn-small" data-action="recebido" data-id="${n.id}">Recebido, vamos providenciar!</button>
        <button class="btn btn-secondary btn-small" data-action="ja-tem-pedido" data-id="${n.id}">Já tem pedido</button>
      `;

      const form = document.createElement('div');
      form.className = 'pedido-form';
      form.id = `form-${n.id}`;
      form.hidden = true;
      form.innerHTML = `
        <input type="text" class="text-input" placeholder="Nº do pedido" id="input-numero-${n.id}">
        <input type="date" class="text-input" id="input-previsao-${n.id}">
        <div class="pedido-form-actions">
          <button class="btn btn-primary btn-small" data-action="confirmar-pedido" data-id="${n.id}">Confirmar</button>
          <button class="btn btn-secondary btn-small" data-action="cancelar-pedido" data-id="${n.id}">Cancelar</button>
        </div>
      `;

      const l1 = document.createElement('div');
      l1.append(cod, desc);
      li.append(l1, meta, acoes, form);
      el.listaPendentes.appendChild(li);
    });

    el.listaCompra.innerHTML = '';
    el.compraVazio.hidden = emCompra.length > 0;
    emCompra.forEach((n) => {
      const li = document.createElement('li');
      li.className = `status-${n.status}`;
      const cod = document.createElement('span');
      cod.className = 'item-codigo';
      cod.textContent = n.codigo;
      const desc = document.createElement('span');
      desc.className = 'item-desc';
      desc.textContent = n.descricao;
      li.append(cod, desc);
      el.listaCompra.appendChild(li);
    });
  }

  el.listaPendentes.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;

    if (action === 'ja-tem-pedido') {
      document.getElementById(`form-${id}`).hidden = false;
      return;
    }
    if (action === 'cancelar-pedido') {
      document.getElementById(`form-${id}`).hidden = true;
      return;
    }

    if (action === 'recebido') {
      btn.disabled = true;
      try {
        await EstoqueStore.responderRecebido(id);
        showError(null);
        await renderFilaEstoque();
      } catch (e) {
        showError(e.message);
        btn.disabled = false;
      }
      return;
    }

    if (action === 'confirmar-pedido') {
      const numeroPedido = document.getElementById(`input-numero-${id}`).value.trim();
      const previsaoEntrega = document.getElementById(`input-previsao-${id}`).value; // AAAA-MM-DD
      btn.disabled = true;
      try {
        await EstoqueStore.responderPedidoExistente(id, { numeroPedido, previsaoEntrega });
        showError(null);
        await renderFilaEstoque();
      } catch (e) {
        showError(e.message);
        btn.disabled = false;
      }
    }
  });

  // ---------------------------------------------------------------------
  initRole();
})();
