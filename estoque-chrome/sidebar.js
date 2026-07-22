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
    btnPapelAcompanhamento: document.getElementById('btn-papel-acompanhamento'),
    rolePillWrap: document.getElementById('role-pill-wrap'),
    rolePill: document.getElementById('role-pill'),
    btnTrocarPerfil: document.getElementById('btn-trocar-perfil'),
    btnConfig: document.getElementById('btn-config'),
    errorBanner: document.getElementById('error-banner'),
    toast: document.getElementById('toast'),

    telaConfig: document.getElementById('tela-config'),
    inputWebappUrl: document.getElementById('input-webapp-url'),
    btnSalvarConfig: document.getElementById('btn-salvar-config'),
    btnFecharConfig: document.getElementById('btn-fechar-config'),
    configStatus: document.getElementById('config-status'),
    chkNotif: document.getElementById('chk-notif'),
    perfilAtualConfig: document.getElementById('perfil-atual-config'),
    connStatusBalcao: document.getElementById('conn-status-balcao'),
    connStatusEstoque: document.getElementById('conn-status-estoque'),
    connStatusAcomp: document.getElementById('conn-status-acomp'),

    viewBalcao: document.getElementById('view-balcao'),
    inputBusca: document.getElementById('input-busca'),
    listaResultados: document.getElementById('lista-resultados'),
    buscaVazio: document.getElementById('busca-vazio'),
    produtoSelecionadoWrap: document.getElementById('produto-selecionado-wrap'),
    selCodigo: document.getElementById('sel-codigo'),
    selDescricao: document.getElementById('sel-descricao'),
    selExistente: document.getElementById('sel-existente'),
    chkCliente: document.getElementById('chk-cliente'),
    btnInformarNecessidade: document.getElementById('btn-informar-necessidade'),
    solicitacoesVazio: document.getElementById('solicitacoes-vazio'),
    listaSolicitacoes: document.getElementById('lista-solicitacoes'),

    viewEstoque: document.getElementById('view-estoque'),
    pendentesCount: document.getElementById('pendentes-count'),
    pendentesVazio: document.getElementById('pendentes-vazio'),
    listaPendentes: document.getElementById('lista-pendentes'),
    compraVazio: document.getElementById('compra-vazio'),
    listaCompra: document.getElementById('lista-compra'),

    viewAcompanhamento: document.getElementById('view-acompanhamento'),
    acompPendentes: document.getElementById('acomp-pendentes'),
    acompAnotados: document.getElementById('acomp-anotados'),
    acompRespondidos: document.getElementById('acomp-respondidos'),
    acompClientes: document.getElementById('acomp-clientes'),
    acompListaPendentes: document.getElementById('acomp-lista-pendentes'),
    acompPendentesVazio: document.getElementById('acomp-pendentes-vazio'),
    acompListaAnotados: document.getElementById('acomp-lista-anotados'),
    acompAnotadosVazio: document.getElementById('acomp-anotados-vazio'),
    acompListaRespondidos: document.getElementById('acomp-lista-respondidos'),
    acompRespondidosVazio: document.getElementById('acomp-respondidos-vazio')
  };

  let produtoSelecionado = null;
  let roleAtual = null;
  let pollTimer = null;

  function showError(msg) {
    el.errorBanner.hidden = !msg;
    el.errorBanner.textContent = msg || '';
  }

  let toastTimer = null;
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2500);
  }

  // Tempo relativo curto (ex.: "há 2 h", "há 3 dias") para o estoque priorizar o que espera há mais tempo.
  function formatRelative(valor) {
    const d = new Date(valor);
    if (isNaN(d.getTime())) return '';
    const seg = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (seg < 90) return 'agora há pouco';
    const min = Math.floor(seg / 60);
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h} h`;
    const dias = Math.floor(h / 24);
    return `há ${dias} dia${dias > 1 ? 's' : ''}`;
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

  // Fila do estoque: itens com cliente aguardando primeiro; depois por mais recente.
  function ordenarFila(lista) {
    return lista.slice().sort((a, b) => {
      if (!!a.clienteAguardando !== !!b.clienteAguardando) return a.clienteAguardando ? -1 : 1;
      return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
    });
  }

  function chipCliente() {
    const span = document.createElement('span');
    span.className = 'chip-cliente';
    span.textContent = 'Cliente aguardando';
    return span;
  }

  // ---------------------------------------------------------------------
  // Status de conexão (planilha x local)
  // ---------------------------------------------------------------------
  async function atualizarStatusConexao() {
    const remoto = await EstoqueStore.isRemote();
    const texto = remoto ? 'Conectado à planilha compartilhada.' : 'Modo local — dados só neste computador (configure a planilha em ⚙).';
    const classe = remoto ? 'remote' : 'local';
    [el.connStatusBalcao, el.connStatusEstoque, el.connStatusAcomp].forEach((node) => {
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
      el.chkNotif.checked = await EstoqueStore.getNotificacoes();
      el.perfilAtualConfig.textContent = PILL_LABEL[roleAtual] || '--';
      el.configStatus.textContent = '';
      el.configStatus.className = 'hint-text';
    }
  });

  el.btnFecharConfig.addEventListener('click', () => { el.telaConfig.hidden = true; });

  // Liga/desliga notificações do Chrome. Ao ligar, pede ao background para capturar a linha
  // de base atual (para não avisar retroativamente sobre itens que já existiam).
  el.chkNotif.addEventListener('change', async () => {
    await EstoqueStore.setNotificacoes(el.chkNotif.checked);
    if (el.chkNotif.checked) {
      chrome.runtime.sendMessage({ type: 'ESTOQUE_SNAPSHOT_RESET' }, () => void chrome.runtime.lastError);
      showToast('Notificações ativadas neste computador.');
    } else {
      showToast('Notificações desativadas.');
    }
  });

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

  const PILL_LABEL = {
    [ROLES.BALCAO]: 'Balcão',
    [ROLES.ESTOQUE]: 'Estoque (Lucas)',
    [ROLES.ACOMPANHAMENTO]: 'Acompanhamento'
  };

  // Estoque e Acompanhamento renderizam itens com os mesmos ids de formulário (form-<id> etc.).
  // Como só um perfil fica visível por vez, limpamos as listas dinâmicas ao trocar de perfil
  // para nunca haver ids duplicados no DOM.
  function limparListasDinamicas() {
    [
      el.listaSolicitacoes, el.listaPendentes, el.listaCompra,
      el.acompListaPendentes, el.acompListaAnotados, el.acompListaRespondidos
    ].forEach((ul) => { if (ul) ul.innerHTML = ''; });
  }

  async function applyRole(role) {
    roleAtual = role;
    el.telaPapel.hidden = true;
    el.rolePillWrap.hidden = false;
    el.rolePill.textContent = PILL_LABEL[role] || role;
    el.viewBalcao.hidden = role !== ROLES.BALCAO;
    el.viewEstoque.hidden = role !== ROLES.ESTOQUE;
    el.viewAcompanhamento.hidden = role !== ROLES.ACOMPANHAMENTO;
    limparListasDinamicas();
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

  el.btnPapelAcompanhamento.addEventListener('click', async () => {
    await EstoqueStore.setRole(ROLES.ACOMPANHAMENTO);
    applyRole(ROLES.ACOMPANHAMENTO);
  });

  el.btnTrocarPerfil.addEventListener('click', () => {
    // Fica dentro do ⚙ (configuração da máquina), não na barra do dia a dia — o usuário comum
    // não troca de perfil; só quem reconfigura/testa. Confirmação evita troca acidental.
    if (!confirm('Trocar o perfil deste computador? Use só para reconfigurar ou testar.')) return;
    pararPolling();
    roleAtual = null;
    el.telaConfig.hidden = true;
    el.telaPapel.hidden = false;
    el.rolePillWrap.hidden = true;
    el.viewBalcao.hidden = true;
    el.viewEstoque.hidden = true;
    el.viewAcompanhamento.hidden = true;
  });

  // ---------------------------------------------------------------------
  // Recarga / polling
  // ---------------------------------------------------------------------
  async function recarregarVisaoAtual() {
    if (roleAtual === ROLES.BALCAO) await renderSolicitacoes();
    else if (roleAtual === ROLES.ESTOQUE) await renderFilaEstoque();
    else if (roleAtual === ROLES.ACOMPANHAMENTO) await renderAcompanhamento();
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
        // Só o balcão usa o catálogo; nos outros perfis, refazê-lo seria uma busca à toa.
        if (roleAtual === ROLES.BALCAO) await EstoqueStore.carregarProdutos(true);
        EstoqueStore.invalidarNecessidades(); // garante fila fresca ao pedir "Atualizar"
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

  async function selecionarProduto(produto) {
    produtoSelecionado = produto;
    el.selCodigo.textContent = produto.codigo;
    el.selDescricao.textContent = produto.descricao;
    el.selExistente.hidden = true;
    el.chkCliente.checked = false;
    el.produtoSelecionadoWrap.hidden = false;
    showError(null);

    // Situação atual: se este produto já tem solicitação/pedido, mostra na hora — evita pedir
    // duplicado e já responde "tem pedido? / previsão?" com os dados que a extensão tem.
    try {
      const necessidades = await EstoqueStore.getNecessidades();
      const doProduto = necessidades
        .filter((n) => n.codigo === produto.codigo)
        .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
      if (doProduto.length > 0) {
        const atual = doProduto[0];
        el.selExistente.innerHTML = '';
        const rotulo = document.createElement('span');
        rotulo.className = 'rotulo';
        rotulo.textContent = 'Situação atual deste produto';
        const linha = document.createElement('span');
        linha.textContent = statusLabel(atual);
        el.selExistente.append(rotulo, linha);
        el.selExistente.hidden = false;
      }
    } catch (e) {
      // Consulta de situação é um extra; se falhar, não bloqueia o pedido.
    }
  }

  el.btnInformarNecessidade.addEventListener('click', async () => {
    if (!produtoSelecionado) return;
    el.btnInformarNecessidade.disabled = true;
    try {
      const comCliente = el.chkCliente.checked;
      await EstoqueStore.criarNecessidade(produtoSelecionado, { clienteAguardando: comCliente });
      showError(null);
      showToast(comCliente ? 'Enviado ao estoque (cliente aguardando).' : 'Enviado ao estoque.');
      produtoSelecionado = null;
      el.produtoSelecionadoWrap.hidden = true;
      el.selExistente.hidden = true;
      el.chkCliente.checked = false;
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
    if (n.status === STATUS.PENDENTE) return 'Enviado ao estoque — aguardando retorno';
    if (n.status === STATUS.EM_COMPRA) return 'Aguarde retorno';
    if (n.status === STATUS.PEDIDO_EXISTENTE) {
      return `Já tem pedido nº ${n.numeroPedido} — previsão de entrega ~${formatDateOnly(n.previsaoEntrega)}`;
    }
    if (n.status === STATUS.OBSERVACAO) {
      return `Estoque: ${n.observacao || ''}`;
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
      if (n.clienteAguardando) linha1.append(chipCliente());
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

  // Monta um item acionável da fila do estoque. `novo` = ainda não visto (mostra o botão
  // "Anotado"); quando já foi anotado, o item continua pendente do retorno final do Lucas
  // (só "Já tem pedido" / "Outra resposta" para fechar o ciclo com o balcão).
  function buildNeedItem(n, { novo }) {
    const li = document.createElement('li');

    const l1 = document.createElement('div');
    const cod = document.createElement('span');
    cod.className = 'item-codigo';
    cod.style.fontWeight = '700';
    cod.textContent = n.codigo;
    const desc = document.createElement('span');
    desc.style.color = 'var(--ink-soft)';
    desc.textContent = ` ${n.descricao}`;
    l1.append(cod, desc);
    if (n.clienteAguardando) l1.append(chipCliente());

    const meta = document.createElement('p');
    meta.className = 'hint-text';
    meta.style.margin = '4px 0 0';
    meta.textContent = novo
      ? `Solicitado ${formatRelative(n.criadoEm)} · ${formatDateTime(n.criadoEm)}`
      : `Anotado ${formatRelative(n.respondidoEm)} · aguardando seu retorno`;

    const acoes = document.createElement('div');
    acoes.className = 'need-actions';
    let botoes = '';
    if (novo) {
      botoes += `<button class="btn btn-primary btn-small" data-action="recebido" data-id="${n.id}">Aguardando retorno</button>`;
    }
    botoes += `<button class="btn btn-${novo ? 'secondary' : 'primary'} btn-small" data-action="ja-tem-pedido" data-id="${n.id}">Já tem pedido</button>`;
    botoes += `<button class="btn btn-secondary btn-small" data-action="observacao-abrir" data-id="${n.id}">Outra resposta</button>`;
    acoes.innerHTML = botoes;

    const form = document.createElement('div');
    form.className = 'pedido-form';
    form.id = `form-${n.id}`;
    form.hidden = true;
    form.innerHTML = `
      <input type="text" class="text-input" placeholder="Nº do pedido" id="input-numero-${n.id}">
      <input type="date" class="text-input" id="input-previsao-${n.id}">
      <div class="pedido-form-actions">
        <button class="btn btn-primary btn-small" data-action="confirmar-pedido" data-id="${n.id}">Responder ao balcão</button>
        <button class="btn btn-secondary btn-small" data-action="cancelar-pedido" data-id="${n.id}">Cancelar</button>
      </div>
    `;

    const obsForm = document.createElement('div');
    obsForm.className = 'pedido-form';
    obsForm.id = `obs-form-${n.id}`;
    obsForm.hidden = true;
    obsForm.innerHTML = `
      <input type="text" class="text-input" placeholder="Ex.: tem no depósito, pode buscar / não vamos repor por ora" id="input-obs-${n.id}">
      <div class="pedido-form-actions">
        <button class="btn btn-primary btn-small" data-action="observacao-enviar" data-id="${n.id}">Enviar ao balcão</button>
        <button class="btn btn-secondary btn-small" data-action="observacao-cancelar" data-id="${n.id}">Cancelar</button>
      </div>
    `;

    li.append(l1, meta, acoes, form, obsForm);
    return li;
  }

  async function renderFilaEstoque() {
    let necessidades;
    try {
      necessidades = await EstoqueStore.getNecessidades();
    } catch (e) {
      showError(e.message);
      return;
    }
    const pendentes = ordenarFila(necessidades.filter((n) => n.status === STATUS.PENDENTE));
    const anotados = ordenarFila(necessidades.filter((n) => n.status === STATUS.EM_COMPRA));

    el.pendentesCount.textContent = String(pendentes.length);
    el.listaPendentes.innerHTML = '';
    el.pendentesVazio.hidden = pendentes.length > 0;
    pendentes.forEach((n) => el.listaPendentes.appendChild(buildNeedItem(n, { novo: true })));

    el.listaCompra.innerHTML = '';
    el.compraVazio.hidden = anotados.length > 0;
    anotados.forEach((n) => el.listaCompra.appendChild(buildNeedItem(n, { novo: false })));
  }

  // ---------------------------------------------------------------------
  // Visão Acompanhamento (gestão) — leitura da troca completa
  // ---------------------------------------------------------------------
  function buildItemLeitura(n, { meta }) {
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
    if (n.clienteAguardando) linha1.append(chipCliente());
    const linha2 = document.createElement('div');
    linha2.className = 'status-line';
    linha2.textContent = statusLabel(n);
    li.append(linha1, linha2);
    if (meta) {
      const m = document.createElement('p');
      m.className = 'hint-text';
      m.style.margin = '4px 0 0';
      m.textContent = meta(n);
      li.append(m);
    }
    return li;
  }

  function preencherLista(ul, vazioEl, lista, opts) {
    ul.innerHTML = '';
    vazioEl.hidden = lista.length > 0;
    lista.forEach((n) => ul.appendChild(buildItemLeitura(n, opts || {})));
  }

  async function renderAcompanhamento() {
    let necessidades;
    try {
      necessidades = await EstoqueStore.getNecessidades();
    } catch (e) {
      showError(e.message);
      return;
    }
    const pendentes = ordenarFila(necessidades.filter((n) => n.status === STATUS.PENDENTE));
    const anotados = ordenarFila(necessidades.filter((n) => n.status === STATUS.EM_COMPRA));
    const respondidos = necessidades
      .filter((n) => n.status === STATUS.PEDIDO_EXISTENTE || n.status === STATUS.OBSERVACAO)
      .sort((a, b) => new Date(b.respondidoEm || b.criadoEm).getTime() - new Date(a.respondidoEm || a.criadoEm).getTime());

    el.acompPendentes.textContent = String(pendentes.length);
    el.acompAnotados.textContent = String(anotados.length);
    el.acompRespondidos.textContent = String(respondidos.length);
    el.acompClientes.textContent = String(necessidades.filter((n) => n.clienteAguardando && (n.status === STATUS.PENDENTE || n.status === STATUS.EM_COMPRA)).length);

    // As duas primeiras seções são acionáveis (mesmas respostas do estoque): a gestão pode
    // intervir e responder, inclusive na ausência do Lucas. Respondidos é histórico (leitura).
    el.acompListaPendentes.innerHTML = '';
    el.acompPendentesVazio.hidden = pendentes.length > 0;
    pendentes.forEach((n) => el.acompListaPendentes.appendChild(buildNeedItem(n, { novo: true })));

    el.acompListaAnotados.innerHTML = '';
    el.acompAnotadosVazio.hidden = anotados.length > 0;
    anotados.forEach((n) => el.acompListaAnotados.appendChild(buildNeedItem(n, { novo: false })));

    preencherLista(el.acompListaRespondidos, el.acompRespondidosVazio, respondidos, {
      meta: (n) => `Respondido ${formatRelative(n.respondidoEm)} · ${formatDateTime(n.respondidoEm)}`
    });
  }

  async function onNeedListClick(ev) {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;

    if (action === 'ja-tem-pedido') {
      document.getElementById(`form-${id}`).hidden = false;
      document.getElementById(`obs-form-${id}`).hidden = true;
      return;
    }
    if (action === 'cancelar-pedido') {
      document.getElementById(`form-${id}`).hidden = true;
      return;
    }
    if (action === 'observacao-abrir') {
      document.getElementById(`obs-form-${id}`).hidden = false;
      document.getElementById(`form-${id}`).hidden = true;
      return;
    }
    if (action === 'observacao-cancelar') {
      document.getElementById(`obs-form-${id}`).hidden = true;
      return;
    }

    if (action === 'recebido') {
      btn.disabled = true;
      try {
        await EstoqueStore.responderRecebido(id);
        showError(null);
        showToast('Anotado — aguardando retorno.');
        await recarregarVisaoAtual();
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
        showToast('Respondido ao balcão.');
        await recarregarVisaoAtual();
      } catch (e) {
        showError(e.message);
        btn.disabled = false;
      }
      return;
    }

    if (action === 'observacao-enviar') {
      const observacao = document.getElementById(`input-obs-${id}`).value.trim();
      btn.disabled = true;
      try {
        await EstoqueStore.responderObservacao(id, { observacao });
        showError(null);
        showToast('Respondido ao balcão.');
        await recarregarVisaoAtual();
      } catch (e) {
        showError(e.message);
        btn.disabled = false;
      }
    }
  }

  // Os itens acionáveis existem nas duas seções (novos pendentes e anotados aguardando
  // retorno), então o mesmo handler escuta as duas listas.
  el.listaPendentes.addEventListener('click', onNeedListClick);
  el.listaCompra.addEventListener('click', onNeedListClick);
  // O perfil Acompanhamento também é acionável (gestão pode responder na ausência do Lucas).
  el.acompListaPendentes.addEventListener('click', onNeedListClick);
  el.acompListaAnotados.addEventListener('click', onNeedListClick);

  // Recarrega ao voltar o foco ao painel — dados sempre frescos sem esperar o ciclo de polling.
  // (O cache curto da fila evita busca redundante se foco e visibilidade dispararem juntos.)
  window.addEventListener('focus', () => { if (roleAtual) recarregarVisaoAtual(); });

  // Pausa o polling quando o painel não está visível (não gasta rede à toa) e retoma —
  // com uma recarga imediata — quando volta a aparecer.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pararPolling();
    } else if (roleAtual) {
      recarregarVisaoAtual();
      iniciarPolling();
    }
  });

  // ---------------------------------------------------------------------
  initRole();
})();
