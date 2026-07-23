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
  var inputEstoque = document.getElementById('cfg-estoque');
  var inputMotorista = document.getElementById('cfg-motorista');
  var statusEstoque = document.getElementById('cfg-estoque-status');
  var statusMotorista = document.getElementById('cfg-motorista-status');
  var saveBtn = document.getElementById('cfg-save');

  function openDrawer() {
    inputEstoque.value = PainelConfig.getEstoqueUrl();
    inputMotorista.value = PainelConfig.getMotoristaUrl();
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
  // Dados reais: Estoque e Motorista (únicos módulos com Web App hoje)
  // ---------------------------------------------------------------------
  function setBadge(el, state, title) {
    if (!el) return;
    el.className = 'live-badge ' + state;
    el.textContent = state === 'live' ? 'ao vivo' : state === 'erro' ? 'erro' : 'exemplo';
    el.title = title || '';
  }

  function renderEstoque(result) {
    var badgeConsulta = document.getElementById('estoque-consulta-badge').querySelector('.live-badge');
    var badgeCentral = document.getElementById('estoque-central-badge');

    if (!result.configured) {
      setBadge(badgeConsulta, 'demo');
      setBadge(badgeCentral, 'demo');
      return;
    }
    if (result.error) {
      setBadge(badgeConsulta, 'erro', result.error);
      setBadge(badgeCentral, 'erro', result.error);
      return;
    }

    setBadge(badgeConsulta, 'live');
    setBadge(badgeCentral, 'live');

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
    if (!result.configured) { setBadge(badge, 'demo'); return; }
    if (result.error) { setBadge(badge, 'erro', result.error); return; }

    setBadge(badge, 'live');
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

  function refreshLiveData() {
    var estoqueUrl = PainelConfig.getEstoqueUrl();
    var motoristaUrl = PainelConfig.getMotoristaUrl();
    PainelEstoque.buscar(estoqueUrl).then(renderEstoque);
    PainelMotorista.buscar(motoristaUrl).then(renderMotorista);
  }

  refreshLiveData();
})();
