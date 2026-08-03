(function () {
  // ---------------------------------------------------------------------
  // Fixar painel (só preferência de UI, guardada no navegador)
  // ---------------------------------------------------------------------
  var pinBtn = document.getElementById('pinBtn');
  var PIN_KEY = 'painelTimoniPinned';
  function applyPin(pinned) {
    pinBtn.setAttribute('aria-pressed', String(pinned));
    pinBtn.querySelector('.pin-mark').textContent = pinned ? '📍' : '📌';
  }
  applyPin(localStorage.getItem(PIN_KEY) === '1');
  pinBtn.addEventListener('click', function () {
    var next = pinBtn.getAttribute('aria-pressed') !== 'true';
    localStorage.setItem(PIN_KEY, next ? '1' : '0');
    applyPin(next);
  });

  // ---------------------------------------------------------------------
  // Filtro por status + navegação entre módulos
  // ---------------------------------------------------------------------
  var filterBtns = document.querySelectorAll('.filter-btn');
  var modules = document.querySelectorAll('.module');
  var chips = document.querySelectorAll('.modchip');

  function chipFor(moduleEl) {
    return document.querySelector('.modchip[data-target="' + moduleEl.id + '"]');
  }

  function applyFilter(mode) {
    modules.forEach(function (mod) {
      var anyVisible = false;
      mod.querySelectorAll('.card').forEach(function (card) {
        var status = card.getAttribute('data-status');
        var show = mode === 'all' || status === mode;
        card.classList.toggle('is-filtered-out', !show);
        if (show) anyVisible = true;
      });
      mod.classList.toggle('is-empty', !anyVisible);
      var chip = chipFor(mod);
      if (chip) chip.classList.toggle('is-hidden', !anyVisible);
    });
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      applyFilter(btn.getAttribute('data-filter'));
    });
  });

  document.querySelectorAll('.details-toggle').forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      var target = document.getElementById(toggle.getAttribute('data-target'));
      var open = target.classList.toggle('open');
      toggle.textContent = toggle.textContent.replace(open ? '+' : '−', open ? '−' : '+');
    });
  });

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var chip = chipFor(entry.target);
        if (!chip || !entry.isIntersecting) return;
        chips.forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
      });
    }, { rootMargin: '-10% 0px -70% 0px', threshold: 0 });
    modules.forEach(function (mod) { observer.observe(mod); });
  }

  // ---------------------------------------------------------------------
  // Drawer de configuração ("⚙ Planilhas")
  // ---------------------------------------------------------------------
  var settingsBtn = document.getElementById('settingsBtn');
  var drawer = document.getElementById('drawer');
  var drawerBackdrop = document.getElementById('drawerBackdrop');
  var drawerClose = document.getElementById('drawerClose');
  var inputCompras = document.getElementById('cfg-compras');
  var inputAgendaUrl = document.getElementById('cfg-agenda-url');
  var inputAgendaToken = document.getElementById('cfg-agenda-token');
  var inputEstoque = document.getElementById('cfg-estoque');
  var inputMotorista = document.getElementById('cfg-motorista');
  var statusCompras = document.getElementById('cfg-compras-status');
  var statusAgendaUrl = document.getElementById('cfg-agenda-url-status');
  var statusAgendaToken = document.getElementById('cfg-agenda-token-status');
  var statusEstoque = document.getElementById('cfg-estoque-status');
  var statusMotorista = document.getElementById('cfg-motorista-status');
  var saveBtn = document.getElementById('cfg-save');

  function openDrawer() {
    inputCompras.value = PainelConfig.getComprasUrl();
    inputAgendaUrl.value = PainelConfig.getAgendaUrl();
    inputAgendaToken.value = PainelConfig.getAgendaToken();
    inputEstoque.value = PainelConfig.getEstoqueUrl();
    inputMotorista.value = PainelConfig.getMotoristaUrl();
    statusCompras.textContent = '';
    statusAgendaUrl.textContent = '';
    statusAgendaToken.textContent = '';
    statusEstoque.textContent = '';
    statusMotorista.textContent = '';
    drawer.classList.add('open');
    drawerBackdrop.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    drawerBackdrop.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }
  settingsBtn.addEventListener('click', openDrawer);
  drawerClose.addEventListener('click', closeDrawer);
  drawerBackdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer();
  });

  saveBtn.addEventListener('click', function () {
    var ok = true;
    try {
      PainelConfig.setComprasUrl(inputCompras.value);
      statusCompras.textContent = '';
    } catch (e) {
      statusCompras.textContent = e.message;
      ok = false;
    }
    try {
      PainelConfig.setAgendaUrl(inputAgendaUrl.value);
      statusAgendaUrl.textContent = '';
    } catch (e) {
      statusAgendaUrl.textContent = e.message;
      ok = false;
    }
    try {
      PainelConfig.setAgendaToken(inputAgendaToken.value);
      statusAgendaToken.textContent = '';
    } catch (e) {
      statusAgendaToken.textContent = e.message;
      ok = false;
    }
    try {
      PainelConfig.setEstoqueUrl(inputEstoque.value);
      statusEstoque.textContent = '';
    } catch (e) {
      statusEstoque.textContent = e.message;
      ok = false;
    }
    try {
      PainelConfig.setMotoristaUrl(inputMotorista.value);
      statusMotorista.textContent = '';
    } catch (e) {
      statusMotorista.textContent = e.message;
      ok = false;
    }
    refreshLiveData();
    if (ok) closeDrawer();
  });

  // ---------------------------------------------------------------------
  // Voltar ao topo
  // ---------------------------------------------------------------------
  var backToTop = document.getElementById('backToTop');
  var SHOW_AFTER_PX = 480;
  function updateBackToTopVisibility() {
    backToTop.classList.toggle('visible', window.scrollY > SHOW_AFTER_PX);
  }
  updateBackToTopVisibility();
  window.addEventListener('scroll', updateBackToTopVisibility, { passive: true });
  backToTop.addEventListener('click', function () {
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    var topHeading = document.getElementById('top');
    if (topHeading) topHeading.focus({ preventScroll: true });
  });

  // ---------------------------------------------------------------------
  // Dados reais: Estoque e Motorista (únicos módulos com Web App hoje)
  // ---------------------------------------------------------------------
  function setBadge(el, state, title) {
    if (!el) return;
    el.className = 'live-badge ' + state;
    el.textContent = state === 'live' ? 'ao vivo' : state === 'erro' ? 'erro' : 'exemplo';
    el.title = title || '';
  }

  // Mostra a mensagem de erro por escrito, direto na tela — o title (tooltip) do badge
  // já carregava o texto, mas exige passar o mouse em cima, o que não é óbvio.
  function setModuleError(moduleId, msg) {
    var el = document.getElementById('err-' + moduleId);
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.hidden = false;
    } else {
      el.hidden = true;
      el.textContent = '';
    }
  }

  function renderEstoque(result) {
    var badgeConsulta = document.getElementById('estoque-consulta-badge').querySelector('.live-badge');
    var badgeCentral = document.getElementById('estoque-central-badge');

    if (!result.configured) {
      setBadge(badgeConsulta, 'demo');
      setBadge(badgeCentral, 'demo');
      setModuleError('estoque', null);
      return;
    }
    if (result.error) {
      setBadge(badgeConsulta, 'erro', result.error);
      setBadge(badgeCentral, 'erro', result.error);
      setModuleError('estoque', result.error);
      return;
    }

    setBadge(badgeConsulta, 'live');
    setBadge(badgeCentral, 'live');
    setModuleError('estoque', null);

    var pillRow = document.getElementById('estoque-consulta-badge');
    pillRow.innerHTML = '';
    pillRow.appendChild(badgeConsulta);
    var pWarn = document.createElement('span');
    pWarn.className = 'pill pill-warn';
    pWarn.textContent = result.consulta.aguardandoEstoque + ' aguardando estoque';
    pillRow.appendChild(pWarn);
    if (result.consulta.clienteAguardando > 0) {
      var pCrit = document.createElement('span');
      pCrit.className = 'pill pill-critical';
      pCrit.textContent = result.consulta.clienteAguardando + ' cliente aguardando';
      pillRow.appendChild(pCrit);
    }

    var listaConsulta = document.getElementById('estoque-consulta-lista');
    listaConsulta.innerHTML = '';
    if (result.consulta.itens.length === 0) {
      listaConsulta.innerHTML = '<li>Nenhuma necessidade em aberto.</li>';
    } else {
      result.consulta.itens.forEach(function (item) {
        var li = document.createElement('li');
        li.textContent = item.descricao + (item.loja ? ' — ' + item.loja : '');
        if (item.clienteAguardando) {
          var pill = document.createElement('span');
          pill.className = 'pill pill-critical';
          pill.textContent = 'cliente aguardando';
          li.appendChild(pill);
        }
        listaConsulta.appendChild(li);
      });
    }

    var stats = document.getElementById('estoque-central-stats');
    stats.innerHTML =
      '<div class="stat warn"><b>' + result.central.aguardando + '</b><span>aguardando</span></div>' +
      '<div class="stat ok"><b>' + result.central.aCaminho + '</b><span>a caminho</span></div>' +
      '<div class="stat critical"><b>' + result.central.atrasado + '</b><span>atrasado</span></div>';

    var listaCentral = document.getElementById('estoque-central-lista');
    listaCentral.innerHTML = '';
    if (result.central.itens.length === 0) {
      listaCentral.innerHTML = '<li>Fila em dia.</li>';
    } else {
      result.central.itens.forEach(function (item) {
        var li = document.createElement('li');
        li.textContent = item.descricao;
        var pill = document.createElement('span');
        if (item.atrasado) {
          pill.className = 'pill pill-critical';
          pill.textContent = 'atrasado';
        } else if (item.numeroPedido) {
          pill.className = 'pill pill-ok';
          pill.textContent = 'pedido ' + item.numeroPedido + (item.previsaoEntrega ? ' · ' + item.previsaoEntrega : '');
        } else {
          pill.className = 'pill pill-neutral';
          pill.textContent = 'em andamento';
        }
        li.appendChild(pill);
        listaCentral.appendChild(li);
      });
    }
  }

  function renderMotorista(result) {
    var badge = document.getElementById('motorista-badge');
    if (!result.configured) { setBadge(badge, 'demo'); setModuleError('motorista', null); return; }
    if (result.error) { setBadge(badge, 'erro', result.error); setModuleError('motorista', result.error); return; }

    setBadge(badge, 'live');
    setModuleError('motorista', null);
    var stats = document.getElementById('motorista-stats');
    stats.innerHTML =
      '<div class="stat ok"><b>' + result.entregas + '</b><span>entregas</span></div>' +
      '<div class="stat ok"><b>' + result.retiradas + '</b><span>retiradas</span></div>' +
      '<div class="stat ' + (result.conflitos > 0 ? 'critical' : 'ok') + '"><b>' + result.conflitos + '</b><span>conflito' + (result.conflitos === 1 ? '' : 's') + '</span></div>';

    var nota = document.getElementById('motorista-nota');
    nota.textContent = result.primeiroConflito
      ? result.primeiroConflito.texto
      : (result.entregas + result.retiradas === 0 ? 'Nenhuma viagem registrada para hoje.' : 'Nenhum conflito de horário hoje.');
  }

  function formatHorario(iso) {
    // Eventos de dia inteiro vêm como "YYYY-MM-DD" (sem hora) — trata separado de dateTime.
    if (!iso || iso.length === 10) return 'dia inteiro';
    var d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function renderAgenda(result) {
    var badge = document.getElementById('agenda-badge');
    if (!result.configured) { setBadge(badge, 'demo'); setModuleError('agenda', null); return; }
    if (result.error) { setBadge(badge, 'erro', result.error); setModuleError('agenda', result.error); return; }

    setBadge(badge, 'live');
    setModuleError('agenda', null);
    var pill = document.getElementById('agenda-pill');
    pill.className = result.total > 0 ? 'pill pill-ok' : 'pill pill-neutral';
    pill.textContent = result.total + (result.total === 1 ? ' evento hoje' : ' eventos hoje');

    var lista = document.getElementById('agenda-lista');
    lista.innerHTML = '';
    if (result.eventos.length === 0) {
      lista.innerHTML = '<li>Nenhum evento hoje.</li>';
    } else {
      result.eventos.slice(0, 5).forEach(function (ev) {
        var li = document.createElement('li');
        li.textContent = formatHorario(ev.inicio) + ' ' + ev.titulo;
        var tag = document.createElement('span');
        tag.className = 'pill pill-neutral';
        tag.textContent = ev.calendario;
        li.appendChild(tag);
        lista.appendChild(li);
      });
    }
    document.getElementById('agenda-meta').textContent = result.atualizadoEm
      ? 'atualizado: ' + new Date(result.atualizadoEm).toLocaleString('pt-BR')
      : 'timoni-portal';
    setCardStatus('card-agenda', 'done');
  }

  function setCardStatus(cardId, status) {
    var card = document.getElementById(cardId);
    if (card) card.setAttribute('data-status', status);
  }

  function renderCompras(result) {
    var badges = ['compras-fornecedores-pills', 'compras-itens-badge', 'compras-conferencia-badge', 'compras-bessani-badge', 'compras-atualizacao-badge']
      .map(function (id) { return document.getElementById(id); });
    var fornecedoresBadge = badges[0].querySelector('.live-badge');

    if (!result.configured) {
      setBadge(fornecedoresBadge, 'demo');
      setBadge(badges[1], 'demo');
      setBadge(badges[2], 'demo');
      setBadge(badges[3], 'demo');
      setBadge(badges[4], 'demo');
      setModuleError('compras', null);
      return;
    }
    if (result.error || result.vazio) {
      var estado = result.error ? 'erro' : 'live';
      var titulo = result.error || 'Aguardando o primeiro registro enviado pela extensão Compras.';
      [fornecedoresBadge, badges[1], badges[2], badges[3], badges[4]].forEach(function (b) {
        setBadge(b, estado, titulo);
      });
      setModuleError('compras', result.error || null);
      return;
    }

    setBadge(fornecedoresBadge, 'live');
    setBadge(badges[1], 'live');
    setBadge(badges[2], 'live');
    setBadge(badges[3], 'live');
    setBadge(badges[4], 'live');
    setModuleError('compras', null);

    // Fornecedores
    var fPillRow = document.getElementById('compras-fornecedores-pills');
    fPillRow.innerHTML = '';
    fPillRow.appendChild(fornecedoresBadge);
    var pTotal = document.createElement('span');
    pTotal.className = 'pill pill-neutral';
    pTotal.textContent = result.fornecedores.total + ' carregados';
    fPillRow.appendChild(pTotal);
    if (result.fornecedores.urgentes > 0) {
      var pUrg = document.createElement('span');
      pUrg.className = 'pill pill-critical';
      pUrg.textContent = result.fornecedores.urgentes + ' urgente' + (result.fornecedores.urgentes === 1 ? '' : 's');
      fPillRow.appendChild(pUrg);
    }
    var fLista = document.getElementById('compras-fornecedores-lista');
    var fToggle = document.getElementById('compras-fornecedores-toggle');
    var fDetails = document.getElementById('det-trello');
    fLista.innerHTML = '';
    if (result.fornecedores.lista.length === 0) {
      fLista.innerHTML = '<li>Nenhum fornecedor lido ainda.</li>';
      fToggle.style.display = 'none';
    } else {
      result.fornecedores.lista.slice(0, 3).forEach(function (f) {
        var li = document.createElement('li');
        li.textContent = f.nome;
        if (f.urgente) {
          var pill = document.createElement('span');
          pill.className = 'pill pill-critical';
          pill.textContent = 'urgente';
          li.appendChild(pill);
        }
        fLista.appendChild(li);
      });
      var fResto = result.fornecedores.lista.slice(3);
      if (fResto.length > 0) {
        fToggle.style.display = '';
        fToggle.textContent = '+ mais ' + fResto.length + ' fornecedor' + (fResto.length === 1 ? '' : 'es');
        fDetails.textContent = fResto.map(function (f) { return f.nome; }).join(', ') + '.';
      } else {
        fToggle.style.display = 'none';
      }
    }
    document.getElementById('compras-fornecedores-meta').textContent = result.fornecedores.ultimaLeitura
      ? 'última leitura: ' + new Date(result.fornecedores.ultimaLeitura).toLocaleString('pt-BR')
      : 'ainda sem leitura';
    setCardStatus('card-compras-fornecedores', result.fornecedores.urgentes > 0 ? 'attention' : 'done');

    // Itens
    document.getElementById('compras-itens-pill').textContent = result.itens.total + (result.itens.total === 1 ? ' item' : ' itens');
    document.getElementById('compras-itens-meta').textContent = result.itens.fornecedor
      ? 'fornecedor: ' + result.itens.fornecedor
      : 'nenhum fornecedor selecionado ainda';
    var iTbody = document.getElementById('compras-itens-tbody');
    var iToggle = document.getElementById('compras-itens-toggle');
    var iDetails = document.getElementById('det-sheets');
    iTbody.innerHTML = '';
    if (result.itens.lista.length === 0) {
      iTbody.innerHTML = '<tr><td colspan="3">Nenhum item extraído ainda.</td></tr>';
      iToggle.style.display = 'none';
    } else {
      result.itens.lista.slice(0, 3).forEach(function (it) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td></td><td></td><td></td>';
        tr.children[0].textContent = it.codigo;
        tr.children[1].textContent = it.descricao;
        tr.children[2].textContent = it.quantidade;
        iTbody.appendChild(tr);
      });
      var iResto = result.itens.lista.slice(3);
      if (iResto.length > 0) {
        iToggle.style.display = '';
        iToggle.textContent = '+ mais ' + iResto.length + (iResto.length === 1 ? ' item' : ' itens');
        iDetails.textContent = iResto.map(function (it) { return it.codigo + ' ' + it.descricao + ' · ' + it.quantidade; }).join(' · ') + '.';
      } else {
        iToggle.style.display = 'none';
      }
    }
    setCardStatus('card-compras-itens', result.itens.total > 0 ? 'done' : 'attention');

    // Conferência de preços
    var conf = result.conferencia;
    var confPill = document.getElementById('compras-conferencia-pill');
    if (conf.aprovado === true) {
      confPill.className = 'pill pill-ok';
      confPill.textContent = 'aprovado';
    } else if (conf.aprovado === false) {
      confPill.className = 'pill pill-critical';
      confPill.textContent = 'não aprovado';
    } else {
      confPill.className = 'pill pill-neutral';
      confPill.textContent = 'pendente';
    }
    document.getElementById('compras-conferencia-meta').textContent =
      (result.itens.fornecedor ? 'fornecedor: ' + result.itens.fornecedor : 'sem fornecedor') +
      (conf.tipoDocumento ? ' · documento: ' + (conf.tipoDocumento === 'nfe' ? 'NF-e' : 'orçamento') : '');
    var confLista = document.getElementById('compras-conferencia-lista');
    confLista.innerHTML = '';
    if (conf.divergencias.length === 0) {
      confLista.innerHTML = '<li>Nenhuma divergência registrada.</li>';
    } else {
      conf.divergencias.forEach(function (d) {
        var li = document.createElement('li');
        li.textContent = (d.item || 'item') + ' — pedido ' + (d.valorPedido || '--') + ' × recebido ' + (d.valorRecebido || '--');
        confLista.appendChild(li);
      });
    }
    document.getElementById('compras-conferencia-nota').textContent = conf.divergencias.length > 0
      ? conf.divergencias.length + ' divergência' + (conf.divergencias.length === 1 ? '' : 's') + ' registrada' + (conf.divergencias.length === 1 ? '' : 's') + ' — ver checklist para detalhes de cada uma.'
      : 'Sem divergências registradas até agora.';
    document.getElementById('compras-conferencia-tag').textContent = conf.aprovado === true
      ? 'aprovado'
      : (conf.divergencias.length > 0 ? 'aguardando aprovação com divergências' : 'aguardando conferência');
    setCardStatus('card-compras-conferencia', conf.aprovado === true ? 'done' : 'attention');

    // Bessani
    var bessaniPill = document.getElementById('compras-bessani-pill');
    var bessaniLink = document.getElementById('compras-bessani-link');
    if (result.bessani.url) {
      bessaniPill.className = 'pill pill-ok';
      bessaniPill.textContent = 'link salvo';
      bessaniLink.lastChild.textContent = result.bessani.url;
    } else {
      bessaniPill.className = 'pill pill-neutral';
      bessaniPill.textContent = 'sem link';
      bessaniLink.lastChild.textContent = '(nenhum link colado ainda)';
    }
    document.getElementById('compras-bessani-meta').textContent = result.bessani.printAnexado
      ? 'print de referência anexado · uso opcional'
      : 'sem print anexado · uso opcional';
    setCardStatus('card-compras-bessani', result.bessani.url ? 'done' : 'attention');

    // Atualização final
    var stats = document.getElementById('compras-atualizacao-stats');
    stats.innerHTML =
      '<div class="stat ok"><b>' + result.atualizacao.atualizados + '</b><span>atualizados</span></div>' +
      '<div class="stat warn"><b>' + result.atualizacao.ignorados + '</b><span>ignorado' + (result.atualizacao.ignorados === 1 ? '' : 's') + '</span></div>' +
      '<div class="stat critical"><b>' + result.atualizacao.naoEncontrados + '</b><span>não encontrado' + (result.atualizacao.naoEncontrados === 1 ? '' : 's') + '</span></div>';
    var aLista = document.getElementById('compras-atualizacao-lista');
    aLista.innerHTML = '';
    if (result.atualizacao.lista.length === 0) {
      aLista.innerHTML = '<li>Nenhuma atualização enviada ainda.</li>';
    } else {
      result.atualizacao.lista.slice(0, 3).forEach(function (r) {
        var li = document.createElement('li');
        li.textContent = r.card;
        var pill = document.createElement('span');
        pill.className = r.status === 'atualizado' ? 'pill pill-ok' : (r.status === 'erro' || r.status === 'não encontrado') ? 'pill pill-critical' : 'pill pill-warn';
        pill.textContent = r.status;
        li.appendChild(pill);
        aLista.appendChild(li);
      });
    }
    var atualOk = result.atualizacao.ignorados === 0 && result.atualizacao.naoEncontrados === 0 && result.atualizacao.atualizados > 0;
    setCardStatus('card-compras-atualizacao', atualOk ? 'done' : 'attention');
  }

  var currentFilter = 'all';
  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { currentFilter = btn.getAttribute('data-filter'); });
  });

  function refreshLiveData() {
    var comprasUrl = PainelConfig.getComprasUrl();
    var agendaUrl = PainelConfig.getAgendaUrl();
    var agendaToken = PainelConfig.getAgendaToken();
    var estoqueUrl = PainelConfig.getEstoqueUrl();
    var motoristaUrl = PainelConfig.getMotoristaUrl();
    Promise.all([
      PainelCompras.buscar(comprasUrl).then(renderCompras),
      PainelAgenda.buscar(agendaUrl, agendaToken).then(renderAgenda),
      PainelEstoque.buscar(estoqueUrl).then(renderEstoque),
      PainelMotorista.buscar(motoristaUrl).then(renderMotorista)
    ]).then(function () { applyFilter(currentFilter); });
  }

  refreshLiveData();
})();
