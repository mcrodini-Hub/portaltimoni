// Lógica da sidebar do módulo Estoque.
// Toda leitura/escrita passa por EstoqueStore (ver lib/store.js), que decide sozinho entre
// modo planilha (Web App do Apps Script, compartilhado) e modo local (fallback só desta
// instalação). Esta camada cuida da interface, estados de carregamento e erros.

(function () {
  const { ROLES, STATUS } = EstoqueStore;

  const el = {
    telaPapel: document.getElementById('tela-papel'),
    rolePillWrap: document.getElementById('role-pill-wrap'),
    rolePill: document.getElementById('role-pill'),
    btnUnidadeBalcao: document.getElementById('btn-unidade-balcao'),
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
    selectVendedor: document.getElementById('select-vendedor'),
    vendedorVazio: document.getElementById('vendedor-vazio'),
    inputBusca: document.getElementById('input-busca'),
    listaResultados: document.getElementById('lista-resultados'),
    buscaVazio: document.getElementById('busca-vazio'),
    produtoSelecionadoWrap: document.getElementById('produto-selecionado-wrap'),
    selCodigo: document.getElementById('sel-codigo'),
    selDescricao: document.getElementById('sel-descricao'),
    selExistente: document.getElementById('sel-existente'),
    inputQuantidade: document.getElementById('input-quantidade'),
    selectUnidadeMedida: document.getElementById('select-unidade-medida'),
    inputNota: document.getElementById('input-nota'),
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
    acaminhoVazio: document.getElementById('acaminho-vazio'),
    listaAcaminho: document.getElementById('lista-acaminho'),

    viewAcompanhamento: document.getElementById('view-acompanhamento'),
    acompPendentes: document.getElementById('acomp-pendentes'),
    acompAnotados: document.getElementById('acomp-anotados'),
    acompRespondidos: document.getElementById('acomp-respondidos'),
    acompClientes: document.getElementById('acomp-clientes'),
    acompResumo: document.getElementById('acomp-resumo'),
    registrarWrap: document.getElementById('registrar-wrap'),
    btnRegistrarToggle: document.getElementById('btn-registrar-toggle'),
    registrarForm: document.getElementById('registrar-form'),
    regCodigo: document.getElementById('reg-codigo'),
    regNumero: document.getElementById('reg-numero'),
    regPrevisao: document.getElementById('reg-previsao'),
    regUnidade: document.getElementById('reg-unidade'),
    btnRegistrarSalvar: document.getElementById('btn-registrar-salvar'),
    btnRegistrarCancelar: document.getElementById('btn-registrar-cancelar'),
    acompListaPendentes: document.getElementById('acomp-lista-pendentes'),
    acompPendentesVazio: document.getElementById('acomp-pendentes-vazio'),
    acompPendentesHint: document.getElementById('acomp-pendentes-hint'),
    acompListaAnotados: document.getElementById('acomp-lista-anotados'),
    acompAnotadosVazio: document.getElementById('acomp-anotados-vazio'),
    acompListaAcaminho: document.getElementById('acomp-lista-acaminho'),
    acompAcaminhoVazio: document.getElementById('acomp-acaminho-vazio'),
    acompListaRespondidos: document.getElementById('acomp-lista-respondidos'),
    acompRespondidosVazio: document.getElementById('acomp-respondidos-vazio'),
    inputBuscaAcomp: document.getElementById('input-busca-acomp'),
    listaResultadosAcomp: document.getElementById('lista-resultados-acomp'),
    buscaVazioAcomp: document.getElementById('busca-vazio-acomp'),
    selAcompWrap: document.getElementById('sel-acomp-wrap'),
    selAcompCodigo: document.getElementById('sel-acomp-codigo'),
    selAcompDescricao: document.getElementById('sel-acomp-descricao'),
    selExistenteAcomp: document.getElementById('sel-existente-acomp')
  };

  let produtoSelecionado = null;
  let roleAtual = null;
  let unidadeAtual = EstoqueStore.UNIDADES.RIO_CLARO;
  let podeAgirAtual = true;
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

  function chipUnidade(n) {
    const span = document.createElement('span');
    span.className = 'chip-unidade';
    span.textContent = EstoqueStore.UNIDADE_LABEL[n.unidade || EstoqueStore.UNIDADES.RIO_CLARO];
    return span;
  }

  function chipVendedor(n) {
    const span = document.createElement('span');
    span.className = 'chip-vendedor';
    span.textContent = n.vendedor;
    return span;
  }

  // Filtra a lista pela unidade do perfil atual. Gestão geral ('todas') vê tudo.
  function filtrarUnidade(lista) {
    if (unidadeAtual === EstoqueStore.UNIDADES.TODAS) return lista;
    return lista.filter((n) => (n.unidade || EstoqueStore.UNIDADES.RIO_CLARO) === unidadeAtual);
  }

  function rotuloPerfil(papel, unidade) {
    const U = EstoqueStore.UNIDADE_LABEL;
    if (papel === ROLES.BALCAO) return 'Vendedores';
    if (papel === ROLES.ESTOQUE) return `Estoque · ${U[unidade]}`;
    if (papel === ROLES.ACOMPANHAMENTO) {
      return unidade === EstoqueStore.UNIDADES.TODAS ? 'Gestão geral' : `Gerência · ${U[unidade]}`;
    }
    return papel;
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
      el.perfilAtualConfig.textContent = roleAtual ? rotuloPerfil(roleAtual, unidadeAtual) : '--';
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
    const papel = await EstoqueStore.getRole();
    if (!papel) {
      el.telaPapel.hidden = false;
      return;
    }
    const unidade = await EstoqueStore.getUnidade();
    applyRole(papel, unidade);
  }

  function atualizarBotaoUnidade() {
    el.btnUnidadeBalcao.textContent = `CT ${EstoqueStore.UNIDADE_LABEL[unidadeAtual]}`;
  }

  // Popula o seletor de vendedor com os nomes da loja atual (nomes sem unidade valem para as
  // duas). Restaura a última escolha deste computador, se ainda estiver na lista.
  async function popularVendedores() {
    let lista = [];
    try {
      lista = await EstoqueStore.carregarVendedores(false);
    } catch (e) {
      // Sem lista agora; segue com seletor vazio.
    }
    const daLoja = lista.filter((v) => !v.unidade || v.unidade === unidadeAtual);
    const salvo = await EstoqueStore.getVendedor();

    el.selectVendedor.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = daLoja.length ? 'Selecione o vendedor…' : '(sem vendedores cadastrados)';
    el.selectVendedor.appendChild(placeholder);
    daLoja.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.nome;
      opt.textContent = v.nome;
      el.selectVendedor.appendChild(opt);
    });
    // Mantém a escolha anterior se ela existe nesta loja.
    el.selectVendedor.value = daLoja.some((v) => v.nome === salvo) ? salvo : '';
    el.vendedorVazio.hidden = daLoja.length > 0;
  }

  el.selectVendedor.addEventListener('change', async () => {
    await EstoqueStore.setVendedor(el.selectVendedor.value);
  });

  // Estoque e Acompanhamento renderizam itens com os mesmos ids de formulário (form-<id> etc.).
  // Como só um perfil fica visível por vez, limpamos as listas dinâmicas ao trocar de perfil
  // para nunca haver ids duplicados no DOM.
  function limparListasDinamicas() {
    [
      el.listaSolicitacoes, el.listaPendentes, el.listaCompra, el.listaAcaminho,
      el.acompListaPendentes, el.acompListaAnotados, el.acompListaAcaminho, el.acompListaRespondidos
    ].forEach((ul) => { if (ul) ul.innerHTML = ''; });
    // Limpa a consulta de produto da Gestão.
    if (el.inputBuscaAcomp) el.inputBuscaAcomp.value = '';
    if (el.listaResultadosAcomp) { el.listaResultadosAcomp.innerHTML = ''; el.listaResultadosAcomp.hidden = true; }
    if (el.buscaVazioAcomp) el.buscaVazioAcomp.hidden = true;
    if (el.selAcompWrap) el.selAcompWrap.hidden = true;
    if (el.selExistenteAcomp) { el.selExistenteAcomp.hidden = true; el.selExistenteAcomp.innerHTML = ''; }
  }

  async function applyRole(papel, unidade) {
    roleAtual = papel;
    unidadeAtual = unidade || EstoqueStore.UNIDADES.RIO_CLARO;
    podeAgirAtual = EstoqueStore.podeAgir(papel, unidadeAtual);
    el.telaPapel.hidden = true;
    el.rolePillWrap.hidden = false;
    el.rolePill.textContent = rotuloPerfil(papel, unidadeAtual);
    // Só o balcão pode alternar de loja (troca de unidade, não de perfil).
    el.btnUnidadeBalcao.hidden = papel !== ROLES.BALCAO;
    if (papel === ROLES.BALCAO) { atualizarBotaoUnidade(); await popularVendedores(); }
    el.viewBalcao.hidden = papel !== ROLES.BALCAO;
    el.viewEstoque.hidden = papel !== ROLES.ESTOQUE;
    el.viewAcompanhamento.hidden = papel !== ROLES.ACOMPANHAMENTO;
    limparListasDinamicas();
    await atualizarStatusConexao();
    await recarregarVisaoAtual();
    iniciarPolling();
  }

  // Seleção de perfil (uma vez, ou ao reconfigurar pelo ⚙).
  document.querySelectorAll('.js-papel').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const papel = btn.dataset.papel;
      const unidade = btn.dataset.unidade;
      await EstoqueStore.setRole(papel);
      await EstoqueStore.setUnidade(unidade);
      applyRole(papel, unidade);
    });
  });

  // Balcão alterna entre CT Rio Claro e CT Araras (só a unidade; o perfil segue Balcão).
  el.btnUnidadeBalcao.addEventListener('click', async () => {
    const nova = unidadeAtual === EstoqueStore.UNIDADES.RIO_CLARO
      ? EstoqueStore.UNIDADES.ARARAS
      : EstoqueStore.UNIDADES.RIO_CLARO;
    await EstoqueStore.setUnidade(nova);
    unidadeAtual = nova;
    atualizarBotaoUnidade();
    await popularVendedores(); // a lista de vendedores muda conforme a loja
    produtoSelecionado = null;
    el.produtoSelecionadoWrap.hidden = true;
    el.selExistente.hidden = true;
    el.inputBusca.value = '';
    el.listaResultados.hidden = true;
    showToast(`Agora atendendo: CT ${EstoqueStore.UNIDADE_LABEL[nova]}`);
    await renderSolicitacoes();
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
    el.btnUnidadeBalcao.hidden = true;
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

  // Pré-seleciona a unidade de medida do produto (se a lista não tiver, acrescenta).
  function aplicarUnidadeProduto(u) {
    const sel = el.selectUnidadeMedida;
    if (!sel) return;
    const val = String(u || '').trim();
    if (!val) { sel.value = 'un'; return; }
    let opt = Array.from(sel.options).find((o) => o.value.toLowerCase() === val.toLowerCase());
    if (!opt) { opt = new Option(val, val); sel.add(opt); }
    sel.value = opt.value;
  }

  async function selecionarProduto(produto) {
    produtoSelecionado = produto;
    el.selCodigo.textContent = produto.codigo;
    el.selDescricao.textContent = produto.descricao + (produto.unidade ? ' · ' + produto.unidade : '');
    aplicarUnidadeProduto(produto.unidade);
    el.selExistente.hidden = true;
    el.chkCliente.checked = false;
    el.produtoSelecionadoWrap.hidden = false;
    showError(null);

    // Situação atual: se este produto já tem solicitação/pedido, mostra na hora — evita pedir
    // duplicado e já responde "tem pedido? / previsão?" com os dados que a extensão tem.
    try {
      const necessidades = filtrarUnidade(await EstoqueStore.getNecessidades());
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
    // Se há vendedores cadastrados, exige a escolha antes de pedir (para o nome constar).
    const vendedor = el.selectVendedor.value;
    if (!vendedor && el.selectVendedor.options.length > 1) {
      showError('Selecione o vendedor antes de pedir.');
      el.selectVendedor.focus();
      return;
    }
    el.btnInformarNecessidade.disabled = true;
    try {
      const comCliente = el.chkCliente.checked;
      const qtdVal = el.inputQuantidade.value.trim();
      const quantidade = qtdVal ? `${qtdVal} ${el.selectUnidadeMedida.value}` : '';
      await EstoqueStore.criarNecessidade(produtoSelecionado, {
        clienteAguardando: comCliente,
        unidade: unidadeAtual,
        vendedor,
        quantidade,
        notaVendedor: el.inputNota.value.trim()
      });
      showError(null);
      showToast(comCliente ? 'Enviado ao estoque (cliente aguardando).' : 'Enviado ao estoque.');
      produtoSelecionado = null;
      el.produtoSelecionadoWrap.hidden = true;
      el.selExistente.hidden = true;
      el.chkCliente.checked = false;
      el.inputQuantidade.value = '';
      el.selectUnidadeMedida.value = 'un';
      el.inputNota.value = '';
      el.inputBusca.value = '';
      el.listaResultados.hidden = true;
      await renderSolicitacoes();
    } catch (e) {
      showError(e.message);
    } finally {
      el.btnInformarNecessidade.disabled = false;
    }
  });

  // ---------------------------------------------------------------------
  // Consultar produto na Gestão — só leitura da situação atual (sem pedir).
  // ---------------------------------------------------------------------
  let buscaAcompTimer = null;
  if (el.inputBuscaAcomp) {
    el.inputBuscaAcomp.addEventListener('input', () => {
      clearTimeout(buscaAcompTimer);
      buscaAcompTimer = setTimeout(() => executarBuscaAcomp(el.inputBuscaAcomp.value), 200);
    });
  }

  async function executarBuscaAcomp(termo) {
    el.listaResultadosAcomp.innerHTML = '';
    if (!termo.trim()) {
      el.listaResultadosAcomp.hidden = true;
      el.buscaVazioAcomp.hidden = true;
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
      el.listaResultadosAcomp.hidden = true;
      el.buscaVazioAcomp.hidden = false;
      return;
    }
    el.buscaVazioAcomp.hidden = true;
    el.listaResultadosAcomp.hidden = false;
    resultados.forEach((produto) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="codigo"></span><span class="desc"></span>`;
      li.querySelector('.codigo').textContent = produto.codigo;
      li.querySelector('.desc').textContent = produto.descricao;
      li.addEventListener('click', () => selecionarProdutoAcomp(produto));
      el.listaResultadosAcomp.appendChild(li);
    });
  }

  async function selecionarProdutoAcomp(produto) {
    el.selAcompCodigo.textContent = produto.codigo;
    el.selAcompDescricao.textContent = produto.descricao + (produto.unidade ? ' · ' + produto.unidade : '');
    el.selAcompWrap.hidden = false;
    el.selExistenteAcomp.innerHTML = '';
    el.selExistenteAcomp.hidden = true;
    el.listaResultadosAcomp.hidden = true;
    showError(null);

    const rotulo = document.createElement('span');
    rotulo.className = 'rotulo';
    rotulo.textContent = 'Situação atual deste produto';
    el.selExistenteAcomp.appendChild(rotulo);

    try {
      const necessidades = filtrarUnidade(await EstoqueStore.getNecessidades());
      const doProduto = necessidades.filter((n) => n.codigo === produto.codigo);
      if (doProduto.length > 0) {
        // Uma linha por loja, com a situação mais recente daquela loja.
        const porUnidade = {};
        doProduto.forEach((n) => {
          const u = n.unidade || EstoqueStore.UNIDADES.RIO_CLARO;
          if (!porUnidade[u] || new Date(n.criadoEm).getTime() > new Date(porUnidade[u].criadoEm).getTime()) {
            porUnidade[u] = n;
          }
        });
        Object.keys(porUnidade).forEach((u) => {
          const linha = document.createElement('span');
          linha.className = 'linha';
          const prefixo = unidadeAtual === EstoqueStore.UNIDADES.TODAS ? `${EstoqueStore.UNIDADE_LABEL[u]}: ` : '';
          linha.textContent = prefixo + statusLabel(porUnidade[u]);
          el.selExistenteAcomp.appendChild(linha);
        });
      } else {
        const linha = document.createElement('span');
        linha.className = 'linha';
        linha.textContent = 'Sem solicitação ou pedido em aberto.';
        el.selExistenteAcomp.appendChild(linha);
      }
      el.selExistenteAcomp.hidden = false;
    } catch (e) {
      // Consulta é um extra; se falhar, não bloqueia o resto da tela.
      el.selExistenteAcomp.hidden = true;
    }
  }

  function statusLabel(n) {
    if (n.status === STATUS.PENDENTE) return 'Enviado ao estoque — aguardando retorno';
    if (n.status === STATUS.EM_COMPRA) return 'Estoque vai fazer a relação de compra — aguarde retorno';
    if (n.status === STATUS.PEDIDO_EXISTENTE) {
      return `A caminho — pedido nº ${n.numeroPedido}, previsão ~${formatDateOnly(n.previsaoEntrega)}`;
    }
    if (n.status === STATUS.CHEGOU) {
      return 'Chegou! Avise o cliente';
    }
    if (n.status === STATUS.OBSERVACAO) {
      return `Estoque: ${n.observacao || ''}`;
    }
    return '';
  }

  // Item parado: pendente/anotado há muito tempo (mais ainda se tem cliente aguardando).
  const HORAS_ATRASO = 24;
  const HORAS_ATRASO_CLIENTE = 4;
  // Itens já resolvidos (chegou/observação) somem da tela depois de alguns dias — ficam
  // guardados na planilha para histórico, só não poluem mais as listas do dia a dia.
  const DIAS_OCULTAR_RESOLVIDOS = 7;

  function resolvidoRecente(n) {
    if (n.status !== STATUS.CHEGOU && n.status !== STATUS.OBSERVACAO) return true;
    const data = new Date(n.chegouEm || n.respondidoEm || n.criadoEm).getTime();
    if (isNaN(data)) return true;
    const dias = (Date.now() - data) / 86400000;
    return dias <= DIAS_OCULTAR_RESOLVIDOS;
  }
  function estaAtrasado(n) {
    if (n.status !== STATUS.PENDENTE && n.status !== STATUS.EM_COMPRA) return false;
    const base = new Date(n.criadoEm).getTime();
    if (isNaN(base)) return false;
    const horas = (Date.now() - base) / 3600000;
    return horas >= (n.clienteAguardando ? HORAS_ATRASO_CLIENTE : HORAS_ATRASO);
  }

  function chipAtrasado() {
    const span = document.createElement('span');
    span.className = 'chip-atrasado';
    span.textContent = 'Atrasado';
    return span;
  }

  async function renderSolicitacoes() {
    let necessidades;
    try {
      necessidades = ordenarPorCriadoDesc(filtrarUnidade(await EstoqueStore.getNecessidades())).filter(resolvidoRecente);
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
      if (n.vendedor) linha1.append(chipVendedor(n));
      const linha2 = document.createElement('div');
      linha2.className = 'status-line';
      linha2.textContent = statusLabel(n);
      li.append(linha1, linha2);
      const info = detalheQtdNota(n);
      if (info) li.append(info);
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
    if (estaAtrasado(n)) l1.append(chipAtrasado());
    if (unidadeAtual === EstoqueStore.UNIDADES.TODAS) l1.append(chipUnidade(n));
    if (n.vendedor) l1.append(chipVendedor(n));

    const meta = document.createElement('p');
    meta.className = 'hint-text';
    meta.style.margin = '4px 0 0';
    meta.textContent = novo
      ? `Solicitado ${formatRelative(n.criadoEm)} · ${formatDateTime(n.criadoEm)}`
      : `Anotado ${formatRelative(n.respondidoEm)} · aguardando seu retorno`;

    const info = detalheQtdNota(n);

    const acoes = document.createElement('div');
    acoes.className = 'need-actions';
    let botoes = '';
    if (novo) {
      botoes += `<button class="btn btn-primary btn-small" data-action="recebido" data-id="${n.id}">Vou fazer a relação de compra</button>`;
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
        <button class="btn btn-primary btn-small" data-action="confirmar-pedido" data-id="${n.id}">Responder ao vendedor</button>
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
        <button class="btn btn-primary btn-small" data-action="observacao-enviar" data-id="${n.id}">Enviar ao vendedor</button>
        <button class="btn btn-secondary btn-small" data-action="observacao-cancelar" data-id="${n.id}">Cancelar</button>
      </div>
    `;

    li.append(l1, meta);
    if (info) li.append(info);
    li.append(acoes, form, obsForm);
    return li;
  }

  // Linha opcional com quantidade e observação do vendedor.
  function detalheQtdNota(n) {
    const partes = [];
    if (n.quantidade) partes.push(`Qtd: ${n.quantidade}`);
    if (n.notaVendedor) partes.push(n.notaVendedor);
    if (!partes.length) return null;
    const p = document.createElement('p');
    p.className = 'hint-text';
    p.style.margin = '2px 0 0';
    p.style.color = 'var(--ink)';
    p.textContent = partes.join(' · ');
    return p;
  }

  // Item da seção "A caminho": mostra o pedido e permite marcar chegada.
  function buildItemACaminho(n) {
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
    if (unidadeAtual === EstoqueStore.UNIDADES.TODAS) l1.append(chipUnidade(n));
    if (n.vendedor) l1.append(chipVendedor(n));

    const meta = document.createElement('p');
    meta.className = 'hint-text';
    meta.style.margin = '4px 0 0';
    meta.textContent = `Pedido nº ${n.numeroPedido} · previsão ~${formatDateOnly(n.previsaoEntrega)}`;

    const acoes = document.createElement('div');
    acoes.className = 'need-actions';
    acoes.innerHTML = `<button class="btn btn-primary btn-small" data-action="chegou" data-id="${n.id}">Chegou</button>`;

    li.append(l1, meta, acoes);
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
    necessidades = filtrarUnidade(necessidades);
    const pendentes = ordenarFila(necessidades.filter((n) => n.status === STATUS.PENDENTE));
    const anotados = ordenarFila(necessidades.filter((n) => n.status === STATUS.EM_COMPRA));
    const aCaminho = ordenarPorCriadoDesc(necessidades.filter((n) => n.status === STATUS.PEDIDO_EXISTENTE));

    el.pendentesCount.textContent = String(pendentes.length);
    el.listaPendentes.innerHTML = '';
    el.pendentesVazio.hidden = pendentes.length > 0;
    pendentes.forEach((n) => el.listaPendentes.appendChild(buildNeedItem(n, { novo: true })));

    el.listaCompra.innerHTML = '';
    el.compraVazio.hidden = anotados.length > 0;
    anotados.forEach((n) => el.listaCompra.appendChild(buildNeedItem(n, { novo: false })));

    el.listaAcaminho.innerHTML = '';
    el.acaminhoVazio.hidden = aCaminho.length > 0;
    aCaminho.forEach((n) => el.listaAcaminho.appendChild(buildItemACaminho(n)));
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
    if (unidadeAtual === EstoqueStore.UNIDADES.TODAS) linha1.append(chipUnidade(n));
    if (n.vendedor) linha1.append(chipVendedor(n));
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

  // Resumo de gestão dos últimos 7 dias: volume, tempo médio de resposta e atrasados.
  function resumoPeriodo(lista) {
    const seteDias = Date.now() - 7 * 24 * 3600000;
    const doPeriodo = lista.filter((n) => new Date(n.criadoEm).getTime() >= seteDias);
    const respondidos = doPeriodo.filter((n) => n.respondidoEm);
    let mediaTxt = '—';
    if (respondidos.length) {
      const horas = respondidos.reduce((soma, n) => soma + (new Date(n.respondidoEm).getTime() - new Date(n.criadoEm).getTime()) / 3600000, 0) / respondidos.length;
      mediaTxt = horas < 1 ? `${Math.round(horas * 60)} min` : `${horas.toFixed(1)} h`;
    }
    const atrasados = lista.filter(estaAtrasado).length;
    return `7 dias: ${doPeriodo.length} pedido(s) · resposta média ${mediaTxt} · ${atrasados} atrasado(s)`;
  }

  async function renderAcompanhamento() {
    let necessidades;
    try {
      necessidades = filtrarUnidade(await EstoqueStore.getNecessidades()).filter(resolvidoRecente);
    } catch (e) {
      showError(e.message);
      return;
    }
    const pendentes = ordenarFila(necessidades.filter((n) => n.status === STATUS.PENDENTE));
    const anotados = ordenarFila(necessidades.filter((n) => n.status === STATUS.EM_COMPRA));
    const aCaminho = ordenarPorCriadoDesc(necessidades.filter((n) => n.status === STATUS.PEDIDO_EXISTENTE));
    const respondidos = necessidades
      .filter((n) => n.status === STATUS.OBSERVACAO || n.status === STATUS.CHEGOU)
      .sort((a, b) => new Date(b.chegouEm || b.respondidoEm || b.criadoEm).getTime() - new Date(a.chegouEm || a.respondidoEm || a.criadoEm).getTime());

    el.acompPendentes.textContent = String(pendentes.length);
    el.acompAnotados.textContent = String(anotados.length);
    el.acompRespondidos.textContent = String(respondidos.length);
    el.acompClientes.textContent = String(necessidades.filter((n) => n.clienteAguardando && (n.status === STATUS.PENDENTE || n.status === STATUS.EM_COMPRA)).length);
    el.acompResumo.textContent = resumoPeriodo(necessidades);

    // "Registrar pedido em aberto" fica disponível para todos os perfis de acompanhamento
    // (gestão geral e gerências) — é a única tarefa que a gerência executa, mesmo sendo leitura
    // no resto. A gerência lança só na sua loja (campo travado); a gestão escolhe a loja.
    el.registrarWrap.hidden = false;
    if (unidadeAtual === EstoqueStore.UNIDADES.TODAS) {
      el.regUnidade.disabled = false;
    } else {
      el.regUnidade.value = unidadeAtual;
      el.regUnidade.disabled = true;
    }

    // Gestão geral pode agir (mesmas respostas do estoque); gerência de unidade é só leitura.
    el.acompPendentesHint.hidden = !podeAgirAtual;
    const construir = podeAgirAtual
      ? (n, novo) => buildNeedItem(n, { novo })
      : (n) => buildItemLeitura(n, { meta: (x) => `Solicitado ${formatRelative(x.criadoEm)} · ${formatDateTime(x.criadoEm)}` });

    el.acompListaPendentes.innerHTML = '';
    el.acompPendentesVazio.hidden = pendentes.length > 0;
    pendentes.forEach((n) => el.acompListaPendentes.appendChild(construir(n, true)));

    el.acompListaAnotados.innerHTML = '';
    el.acompAnotadosVazio.hidden = anotados.length > 0;
    anotados.forEach((n) => el.acompListaAnotados.appendChild(construir(n, false)));

    // "A caminho" é acionável (marcar chegada) só para quem pode agir; senão, leitura.
    el.acompListaAcaminho.innerHTML = '';
    el.acompAcaminhoVazio.hidden = aCaminho.length > 0;
    aCaminho.forEach((n) => el.acompListaAcaminho.appendChild(
      podeAgirAtual ? buildItemACaminho(n) : buildItemLeitura(n, { meta: (x) => `Pedido nº ${x.numeroPedido} · previsão ~${formatDateOnly(x.previsaoEntrega)}` })
    ));

    preencherLista(el.acompListaRespondidos, el.acompRespondidosVazio, respondidos, {
      meta: (n) => n.status === STATUS.CHEGOU
        ? `Chegou ${formatRelative(n.chegouEm)} · ${formatDateTime(n.chegouEm)}`
        : `Respondido ${formatRelative(n.respondidoEm)} · ${formatDateTime(n.respondidoEm)}`
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
        showToast('Anotado — vou fazer a relação de compra.');
        await recarregarVisaoAtual();
      } catch (e) {
        showError(e.message);
        btn.disabled = false;
      }
      return;
    }

    if (action === 'chegou') {
      btn.disabled = true;
      try {
        await EstoqueStore.marcarChegada(id);
        showError(null);
        showToast('Chegada registrada — o vendedor será avisado.');
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
        showToast('Respondido ao vendedor.');
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
        showToast('Respondido ao vendedor.');
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

  // Registrar pedido em aberto (gestão e gerências)
  el.btnRegistrarToggle.addEventListener('click', () => {
    el.registrarForm.hidden = !el.registrarForm.hidden;
  });
  el.btnRegistrarCancelar.addEventListener('click', () => { el.registrarForm.hidden = true; });
  el.btnRegistrarSalvar.addEventListener('click', async () => {
    el.btnRegistrarSalvar.disabled = true;
    try {
      await EstoqueStore.registrarPedidoEmAberto({
        codigo: el.regCodigo.value,
        unidade: el.regUnidade.value,
        numeroPedido: el.regNumero.value.trim(),
        previsaoEntrega: el.regPrevisao.value // AAAA-MM-DD
      });
      showError(null);
      showToast('Pedido registrado.');
      el.regCodigo.value = ''; el.regNumero.value = ''; el.regPrevisao.value = '';
      el.registrarForm.hidden = true;
      await recarregarVisaoAtual();
    } catch (e) {
      showError(e.message);
    } finally {
      el.btnRegistrarSalvar.disabled = false;
    }
  });

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
