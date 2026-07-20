// Sidebar — única interface do Hub de Pedidos. Lê o estado diretamente do
// chrome.storage.local (via lib/state.js) e reage a mudanças em tempo real
// através de chrome.storage.onChanged — isso substitui o mecanismo de mensageria
// da base v1.0.12, que não chegava a atualizar a sidebar de forma confiável.

const { STATES } = HubState;
const { TYPES, send } = HubMessages;

const STATE_LABELS = {
  INICIO: 'Aguardando início',
  TRELLO_ABERTO: 'Trello aberto — lendo fornecedores…',
  FORNECEDORES_CARREGADOS: 'Fornecedores carregados',
  FORNECEDOR_SELECIONADO: 'Fornecedor selecionado',
  DRIVE_ABERTO: 'Google Drive aberto',
  PLANILHA_ABERTA: 'Lendo planilha…',
  ITENS_EXTRAIDOS: 'Itens extraídos',
  BESSANI_ABERTO: 'Bessani aberto',
  PRONTO_PARA_ATUALIZAR: 'Atualizando Trello…',
  FINALIZADO: 'Finalizado',
  ERRO: 'Erro'
};

const RESULT_LABELS = {
  atualizado: 'atualizado',
  ignorado: 'ignorado',
  'não encontrado': 'não encontrado',
  erro: 'erro'
};

const el = (id) => document.getElementById(id);

const ui = {
  btnPin: el('btn-pin'),
  btnClose: el('btn-close'),
  chkFixar: el('chk-fixar'),
  errorBanner: el('error-banner'),
  stateBadge: el('state-badge'),

  trelloStatus: el('trello-status'),
  btnAbrirTrello: el('btn-abrir-trello'),

  fornecedoresPlaceholder: el('fornecedores-placeholder'),
  fornecedoresWrap: el('fornecedores-wrap'),
  fornecedoresCount: el('fornecedores-count'),
  fornecedoresLista: el('fornecedores-lista'),
  btnAtualizarFornecedores: el('btn-atualizar-fornecedores'),
  btnAbrirDrive: el('btn-abrir-drive'),

  btnExtrairItens: el('btn-extrair-itens'),
  itensWrap: el('itens-wrap'),
  itensTotal: el('itens-total'),
  itensLista: el('itens-lista'),

  inputBessani: el('input-bessani'),
  btnAbrirBessani: el('btn-abrir-bessani'),

  resumoWrap: el('resumo-wrap'),
  resumoFornecedor: el('resumo-fornecedor'),
  resumoItens: el('resumo-itens'),
  btnAtualizarTrello: el('btn-atualizar-trello'),
  confirmWrap: el('confirm-wrap'),
  btnConfirmarUpdate: el('btn-confirmar-update'),
  btnCancelarUpdate: el('btn-cancelar-update'),
  resultadosLista: el('resultados-lista'),

  btnReiniciar: el('btn-reiniciar'),

  btnToggleDiag: el('btn-toggle-diag'),
  diagWrap: el('diag-wrap'),
  diagText: el('diag-text'),
  btnCopiarDiag: el('btn-copiar-diag')
};

let confirmOpen = false;
let bessaniInputFocused = false;

function normalize(str) {
  return (str || '').toString().trim().toLowerCase();
}

function statusClass(status) {
  const map = {
    atualizado: 'status-atualizado',
    ignorado: 'status-ignorado',
    'não encontrado': 'status-nao-encontrado',
    erro: 'status-erro'
  };
  return map[status] || 'status-ignorado';
}

function render(state) {
  if (!state) return;

  ui.stateBadge.textContent = STATE_LABELS[state.currentState] || state.currentState;

  if (state.lastError) {
    ui.errorBanner.hidden = false;
    ui.errorBanner.textContent = state.lastError;
  } else {
    ui.errorBanner.hidden = true;
    ui.errorBanner.textContent = '';
  }

  ui.chkFixar.checked = !!state.pinned;
  ui.btnPin.setAttribute('aria-pressed', state.pinned ? 'true' : 'false');

  // Etapa 1
  ui.trelloStatus.textContent = state.trelloScanned ? 'Trello: conectado' : 'Trello: não conectado';

  // Etapa 2
  const hasSuppliers = !!state.trelloScanned;
  ui.fornecedoresPlaceholder.hidden = hasSuppliers;
  ui.fornecedoresWrap.hidden = !hasSuppliers;
  if (hasSuppliers) {
    ui.fornecedoresCount.textContent = `Fornecedores encontrados: ${state.suppliers.length}`;
    ui.fornecedoresLista.innerHTML = '';
    if (state.suppliers.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Nenhum fornecedor com etiqueta Rio Claro encontrado.';
      li.style.cursor = 'default';
      ui.fornecedoresLista.appendChild(li);
    } else {
      state.suppliers.forEach((f) => {
        const li = document.createElement('li');
        const selected = state.selectedSupplier && normalize(state.selectedSupplier.nome) === normalize(f.nome);
        li.className = selected ? 'selected' : '';
        li.innerHTML = `<span class="dot"></span><span>${escapeHtml(f.nome)}</span>`;
        li.addEventListener('click', () => onSelectSupplier(f));
        ui.fornecedoresLista.appendChild(li);
      });
    }
  }
  ui.btnAbrirDrive.disabled = !state.selectedSupplier;

  // Etapa 3
  ui.btnExtrairItens.disabled = !state.driveOpened;
  const hasItems = state.extractedItems && state.extractedItems.length > 0;
  ui.itensWrap.hidden = !hasItems;
  if (hasItems) {
    ui.itensTotal.textContent = `Total de itens: ${state.extractedItems.length}`;
    ui.itensLista.innerHTML = '';
    state.extractedItems.forEach((it) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="col-codigo">${escapeHtml(it.codigo)}</span><span class="col-desc">${escapeHtml(it.descricao)}</span><span class="col-qtd">${escapeHtml(it.quantidade)}</span>`;
      ui.itensLista.appendChild(li);
    });
  }

  // Etapa 4
  if (!bessaniInputFocused) {
    ui.inputBessani.value = state.bessaniUrl || '';
  }
  ui.btnAbrirBessani.disabled = !state.bessaniUrl;

  // Etapa 5
  const canUpdate = !!state.selectedSupplier && hasItems;
  ui.resumoWrap.hidden = !canUpdate;
  if (canUpdate) {
    ui.resumoFornecedor.textContent = state.selectedSupplier.nome;
    ui.resumoItens.textContent = String(state.extractedItems.length);
  }
  ui.btnAtualizarTrello.disabled = !canUpdate;

  ui.resultadosLista.innerHTML = '';
  (state.trelloUpdateResults || []).forEach((r) => {
    const li = document.createElement('li');
    li.className = statusClass(r.status);
    li.innerHTML = `<span>${escapeHtml(r.card)}</span><strong>${escapeHtml(RESULT_LABELS[r.status] || r.status)}</strong>`;
    ui.resultadosLista.appendChild(li);
  });

  renderDiagnostics(state);
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value === undefined || value === null ? '' : String(value);
  return div.innerHTML;
}

function renderDiagnostics(state) {
  const d = state.diagnostics || {};
  const lines = [
    `Estado atual: ${state.currentState}`,
    `URL da aba ativa (última conhecida): ${d.activeTabUrl || '--'}`,
    `Cartões lidos no Trello: ${d.cardsRead ?? '--'}`,
    `Cartões Rio Claro: ${d.rioClaroCards ?? '--'}`,
    `Fornecedores encontrados: ${d.suppliersFound ?? state.suppliers.length}`,
    `Fornecedor selecionado: ${state.selectedSupplier ? state.selectedSupplier.nome : '--'}`,
    `Itens extraídos: ${d.itemsExtracted ?? state.extractedItems.length}`,
    `Último erro: ${state.lastError || '--'}`
  ];
  ui.diagText.textContent = lines.join('\n');
}

// ---------------------------------------------------------------------------
// Ações do usuário
// ---------------------------------------------------------------------------

async function withBusy(button, fn) {
  const original = button.textContent;
  button.disabled = true;
  try {
    const result = await fn();
    if (result && result.error) {
      await HubState.setState({ lastError: result.error, currentState: STATES.ERRO });
    }
  } finally {
    button.textContent = original;
    refresh();
  }
}

ui.btnAbrirTrello.addEventListener('click', () => withBusy(ui.btnAbrirTrello, () => send(TYPES.OPEN_TRELLO, null, 'sidebar')));
ui.btnAtualizarFornecedores.addEventListener('click', () => withBusy(ui.btnAtualizarFornecedores, () => send(TYPES.SCAN_TRELLO, null, 'sidebar')));
ui.btnAbrirDrive.addEventListener('click', () => withBusy(ui.btnAbrirDrive, () => send(TYPES.OPEN_DRIVE, null, 'sidebar')));
ui.btnExtrairItens.addEventListener('click', () => withBusy(ui.btnExtrairItens, () => send(TYPES.EXTRACT_ITEMS, null, 'sidebar')));
ui.btnAbrirBessani.addEventListener('click', () => withBusy(ui.btnAbrirBessani, () => send(TYPES.OPEN_BESSANI, null, 'sidebar')));

function onSelectSupplier(supplier) {
  withBusy(ui.btnAbrirDrive, () => send(TYPES.SELECT_SUPPLIER, { supplier }, 'sidebar'));
}

ui.inputBessani.addEventListener('focus', () => { bessaniInputFocused = true; });
ui.inputBessani.addEventListener('blur', () => {
  bessaniInputFocused = false;
  const url = ui.inputBessani.value.trim();
  send(TYPES.SAVE_BESSANI_URL, { url }, 'sidebar').then(refresh);
});

ui.btnAtualizarTrello.addEventListener('click', () => {
  confirmOpen = true;
  ui.confirmWrap.hidden = false;
  ui.btnAtualizarTrello.hidden = true;
});

ui.btnCancelarUpdate.addEventListener('click', () => {
  confirmOpen = false;
  ui.confirmWrap.hidden = true;
  ui.btnAtualizarTrello.hidden = false;
});

ui.btnConfirmarUpdate.addEventListener('click', () => {
  confirmOpen = false;
  ui.confirmWrap.hidden = true;
  ui.btnAtualizarTrello.hidden = false;
  withBusy(ui.btnConfirmarUpdate, () => send(TYPES.UPDATE_TRELLO, null, 'sidebar'));
});

ui.btnReiniciar.addEventListener('click', () => {
  const ok = window.confirm('Reiniciar o fluxo? Fornecedor selecionado e itens extraídos serão limpos.');
  if (!ok) return;
  withBusy(ui.btnReiniciar, () => send(TYPES.RESET_WORKFLOW, null, 'sidebar'));
});

function togglePinned(nextValue) {
  send(TYPES.TOGGLE_PIN, { pinned: nextValue }, 'sidebar').then(refresh);
}

ui.chkFixar.addEventListener('change', () => togglePinned(ui.chkFixar.checked));
ui.btnPin.addEventListener('click', () => togglePinned(!ui.chkFixar.checked));

ui.btnClose.addEventListener('click', () => {
  // O Chrome não expõe uma API confiável para fechar o side panel via script.
  // Tentamos window.close() como best-effort; se o Chrome bloquear, não fazemos nada
  // (ver limitações conhecidas no TESTES.md).
  try {
    window.close();
  } catch (e) {
    /* ignorado de propósito */
  }
});

ui.btnToggleDiag.addEventListener('click', () => {
  const showing = !ui.diagWrap.hidden;
  ui.diagWrap.hidden = showing;
  ui.btnToggleDiag.textContent = showing ? 'Mostrar diagnóstico' : 'Ocultar diagnóstico';
});

ui.btnCopiarDiag.addEventListener('click', async () => {
  const text = ui.diagText.textContent;
  try {
    await navigator.clipboard.writeText(text);
    flashButton(ui.btnCopiarDiag, 'Copiado!');
  } catch (e) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      flashButton(ui.btnCopiarDiag, 'Copiado!');
    } catch (e2) {
      flashButton(ui.btnCopiarDiag, 'Não foi possível copiar');
    }
  }
});

function flashButton(button, text) {
  const original = button.textContent;
  button.textContent = text;
  setTimeout(() => { button.textContent = original; }, 1500);
}

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

function refresh() {
  HubState.getState().then(render);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[HubState.STORAGE_KEY]) {
    render(changes[HubState.STORAGE_KEY].newValue);
  }
});

document.addEventListener('DOMContentLoaded', refresh);
refresh();
