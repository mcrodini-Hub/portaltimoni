// Lógica da sidebar do módulo Estoque. Sem background/content scripts por enquanto — toda
// leitura/escrita é direta em chrome.storage.local via EstoqueStore (ver lib/store.js).
// Quando a fonte real do catálogo/necessidades for conectada (planilha), essa camada troca
// para passar pelas mensagens ao background, no mesmo padrão do hub-pedidos-chrome.

(function () {
  const { ROLES, STATUS } = EstoqueStore;

  const el = {
    telaPapel: document.getElementById('tela-papel'),
    btnPapelBalcao: document.getElementById('btn-papel-balcao'),
    btnPapelEstoque: document.getElementById('btn-papel-estoque'),
    rolePillWrap: document.getElementById('role-pill-wrap'),
    rolePill: document.getElementById('role-pill'),
    btnTrocarPerfil: document.getElementById('btn-trocar-perfil'),
    errorBanner: document.getElementById('error-banner'),

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

  function showError(msg) {
    if (!msg) {
      el.errorBanner.hidden = true;
      el.errorBanner.textContent = '';
      return;
    }
    el.errorBanner.hidden = false;
    el.errorBanner.textContent = msg;
  }

  function formatDate(ts) {
    if (!ts) return '--';
    return new Date(ts).toLocaleString('pt-BR');
  }

  // ---------------------------------------------------------------------
  // Papel do computador (Balcão / Estoque)
  // ---------------------------------------------------------------------

  async function initRole() {
    const role = await EstoqueStore.getRole();
    if (!role) {
      el.telaPapel.hidden = false;
      return;
    }
    applyRole(role);
  }

  function applyRole(role) {
    el.telaPapel.hidden = true;
    el.rolePillWrap.hidden = false;
    el.rolePill.textContent = role === ROLES.BALCAO ? 'Balcão' : 'Estoque (Lucas)';
    el.viewBalcao.hidden = role !== ROLES.BALCAO;
    el.viewEstoque.hidden = role !== ROLES.ESTOQUE;
    if (role === ROLES.BALCAO) renderSolicitacoes();
    else renderFilaEstoque();
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
    el.telaPapel.hidden = false;
    el.rolePillWrap.hidden = true;
    el.viewBalcao.hidden = true;
    el.viewEstoque.hidden = true;
  });

  // ---------------------------------------------------------------------
  // Visão Balcão — Módulo 1
  // ---------------------------------------------------------------------

  let buscaTimer = null;
  el.inputBusca.addEventListener('input', () => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(() => executarBusca(el.inputBusca.value), 150);
  });

  async function executarBusca(termo) {
    const resultados = termo.trim() ? await EstoqueStore.buscarProdutos(termo) : [];
    el.listaResultados.innerHTML = '';

    if (!termo.trim()) {
      el.listaResultados.hidden = true;
      el.buscaVazio.hidden = true;
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
      li.innerHTML = `<span class="codigo">${produto.codigo}</span>${produto.descricao}`;
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
    }
  });

  function statusLabel(necessidade) {
    if (necessidade.status === STATUS.PENDENTE) {
      return 'Aguardando resposta do estoque';
    }
    if (necessidade.status === STATUS.EM_COMPRA) {
      return 'Recebido — providenciando pedido de compra';
    }
    if (necessidade.status === STATUS.PEDIDO_EXISTENTE) {
      const r = necessidade.resposta || {};
      return `O produto já consta no Pedido ${r.numeroPedido} — Previsão de entrega: ${r.previsaoEntrega}`;
    }
    return '';
  }

  async function renderSolicitacoes() {
    const necessidades = await EstoqueStore.getNecessidades();
    el.listaSolicitacoes.innerHTML = '';

    if (necessidades.length === 0) {
      el.solicitacoesVazio.hidden = false;
      return;
    }
    el.solicitacoesVazio.hidden = true;

    necessidades.forEach((n) => {
      const li = document.createElement('li');
      li.className = `status-${n.status}`;
      li.innerHTML = `
        <div><span class="item-codigo">${n.codigo}</span><span class="item-desc">${n.descricao}</span></div>
        <div class="status-line">${statusLabel(n)}</div>
      `;
      el.listaSolicitacoes.appendChild(li);
    });
  }

  // ---------------------------------------------------------------------
  // Visão Estoque (Lucas) — Módulo 2
  // ---------------------------------------------------------------------

  async function renderFilaEstoque() {
    const necessidades = await EstoqueStore.getNecessidades();
    const pendentes = necessidades.filter((n) => n.status === STATUS.PENDENTE);
    const emCompra = necessidades.filter((n) => n.status === STATUS.EM_COMPRA);

    el.pendentesCount.textContent = String(pendentes.length);
    el.listaPendentes.innerHTML = '';
    el.pendentesVazio.hidden = pendentes.length > 0;

    pendentes.forEach((n) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div><span class="item-codigo">${n.codigo}</span><span class="item-desc">${n.descricao}</span></div>
        <p class="hint-text" style="margin:4px 0 0;">Solicitado em ${formatDate(n.criadoEm)}</p>
        <div class="need-actions">
          <button class="btn btn-primary btn-small" data-action="recebido" data-id="${n.id}">Recebido, vamos providenciar!</button>
          <button class="btn btn-secondary btn-small" data-action="ja-tem-pedido" data-id="${n.id}">Já tem pedido</button>
        </div>
        <div class="pedido-form" id="form-${n.id}" hidden>
          <input type="text" class="text-input" placeholder="Nº do pedido" id="input-numero-${n.id}">
          <input type="date" class="text-input" id="input-previsao-${n.id}">
          <div class="pedido-form-actions">
            <button class="btn btn-primary btn-small" data-action="confirmar-pedido" data-id="${n.id}">Confirmar</button>
            <button class="btn btn-secondary btn-small" data-action="cancelar-pedido" data-id="${n.id}">Cancelar</button>
          </div>
        </div>
      `;
      el.listaPendentes.appendChild(li);
    });

    el.listaCompra.innerHTML = '';
    el.compraVazio.hidden = emCompra.length > 0;
    emCompra.forEach((n) => {
      const li = document.createElement('li');
      li.className = `status-${n.status}`;
      li.innerHTML = `<span class="item-codigo">${n.codigo}</span><span class="item-desc">${n.descricao}</span>`;
      el.listaCompra.appendChild(li);
    });
  }

  el.listaPendentes.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;

    if (action === 'recebido') {
      try {
        await EstoqueStore.responderRecebido(id);
        showError(null);
        await renderFilaEstoque();
      } catch (e) {
        showError(e.message);
      }
      return;
    }

    if (action === 'ja-tem-pedido') {
      document.getElementById(`form-${id}`).hidden = false;
      return;
    }

    if (action === 'cancelar-pedido') {
      document.getElementById(`form-${id}`).hidden = true;
      return;
    }

    if (action === 'confirmar-pedido') {
      const numeroPedido = document.getElementById(`input-numero-${id}`).value.trim();
      const previsaoInput = document.getElementById(`input-previsao-${id}`).value;
      const previsaoEntrega = previsaoInput ? new Date(`${previsaoInput}T00:00:00`).toLocaleDateString('pt-BR') : '';
      try {
        await EstoqueStore.responderPedidoExistente(id, { numeroPedido, previsaoEntrega });
        showError(null);
        await renderFilaEstoque();
      } catch (e) {
        showError(e.message);
      }
    }
  });

  // ---------------------------------------------------------------------

  initRole();
})();
