// Sidebar — única interface do Compras. Lê o estado diretamente do
// chrome.storage.local (via lib/state.js) e reage a mudanças em tempo real
// através de chrome.storage.onChanged — isso substitui o mecanismo de mensageria
// da base v1.0.12, que não chegava a atualizar a sidebar de forma confiável.

const { STATES, CONFERENCIA_CHECKLIST_ITEMS } = HubState;
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

  inputSheetUrl: el('input-sheet-url'),
  btnExtrairItens: el('btn-extrair-itens'),
  itensWrap: el('itens-wrap'),
  itensTotal: el('itens-total'),
  itensLista: el('itens-lista'),

  inputBessani: el('input-bessani'),
  btnAbrirBessani: el('btn-abrir-bessani'),
  printDropzone: el('print-dropzone'),
  inputPrintUpload: el('input-print-upload'),
  printPreviewWrap: el('print-preview-wrap'),
  printPreviewImg: el('print-preview-img'),
  btnRemoverPrint: el('btn-remover-print'),

  radioDocOrcamento: el('radio-doc-orcamento'),
  radioDocNfe: el('radio-doc-nfe'),
  docOrcamentoHint: el('doc-orcamento-hint'),
  conferenciaChecklist: el('conferencia-checklist'),
  divergenciasLista: el('divergencias-lista'),
  inputDivItem: el('input-div-item'),
  inputDivPedido: el('input-div-pedido'),
  inputDivRecebido: el('input-div-recebido'),
  inputDivObs: el('input-div-obs'),
  btnAddDivergencia: el('btn-add-divergencia'),
  conferenciaStatus: el('conferencia-status'),
  btnAprovarConferencia: el('btn-aprovar-conferencia'),
  conferenciaConfirmWrap: el('conferencia-confirm-wrap'),
  conferenciaConfirmText: el('conferencia-confirm-text'),
  btnConfirmarAprovarConferencia: el('btn-confirmar-aprovar-conferencia'),
  btnCancelarAprovarConferencia: el('btn-cancelar-aprovar-conferencia'),

  resumoWrap: el('resumo-wrap'),
  resumoFornecedor: el('resumo-fornecedor'),
  resumoItens: el('resumo-itens'),
  conferenciaBloqueioHint: el('conferencia-bloqueio-hint'),
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
let sheetUrlInputFocused = false;

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
        const urgenteTag = f.urgente ? ' <span class="tag-urgente">Urgente</span>' : '';
        li.innerHTML = `<span class="dot"></span><span>${escapeHtml(f.nome)}</span>${urgenteTag}`;
        li.addEventListener('click', () => onSelectSupplier(f));
        ui.fornecedoresLista.appendChild(li);
      });
    }
  }
  ui.btnAbrirDrive.disabled = !state.selectedSupplier;

  // Etapa 3
  if (!sheetUrlInputFocused) {
    ui.inputSheetUrl.value = state.sheetUrl || '';
  }
  ui.btnExtrairItens.disabled = !state.driveOpened && !state.sheetUrl;
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

  const hasPrint = !!state.bessaniPrint;
  ui.printDropzone.hidden = hasPrint;
  ui.printPreviewWrap.hidden = !hasPrint;
  if (hasPrint) {
    ui.printPreviewImg.src = state.bessaniPrint;
  }

  // Etapa 5 (Conferência)
  renderConferencia(state);

  // Etapa 6
  const conferenciaAprovada = !!(state.conferencia && state.conferencia.aprovado === true);
  const canUpdate = !!state.selectedSupplier && hasItems && conferenciaAprovada;
  ui.resumoWrap.hidden = !(state.selectedSupplier && hasItems);
  if (state.selectedSupplier && hasItems) {
    ui.resumoFornecedor.textContent = state.selectedSupplier.nome;
    ui.resumoItens.textContent = String(state.extractedItems.length);
  }
  ui.conferenciaBloqueioHint.hidden = !(state.selectedSupplier && hasItems && !conferenciaAprovada);
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
  const c = state.conferencia || {};
  const lines = [
    `Estado atual: ${state.currentState}`,
    `URL da aba ativa (última conhecida): ${d.activeTabUrl || '--'}`,
    `Cartões lidos no Trello: ${d.cardsRead ?? '--'}`,
    `Cartões Rio Claro: ${d.rioClaroCards ?? '--'}`,
    `Verificação lenta (abrindo cartões) usada: ${d.usedDeepScan ? 'sim' : 'não'}`,
    `Fornecedores encontrados: ${d.suppliersFound ?? state.suppliers.length}`,
    `Fornecedor selecionado: ${state.selectedSupplier ? state.selectedSupplier.nome : '--'}`,
    `Itens extraídos: ${d.itemsExtracted ?? state.extractedItems.length}`,
    `Conferência — data: ${formatDate(c.dataConferencia)}`,
    `Conferência — divergências: ${(c.divergencias || []).length}`,
    `Conferência — aprovado: ${c.aprovado === true ? 'S' : c.aprovado === false ? 'N' : '--'}`,
    `Último erro: ${state.lastError || '--'}`
  ];
  if (d.rowsRead !== undefined) {
    lines.push(`Linhas lidas na planilha: ${d.rowsRead}`);
    lines.push(`Usou leitura alternativa (tabela HTML): ${d.usedFallbackTable ? 'sim' : 'não'}`);
    lines.push('Prévia das primeiras linhas lidas:');
    lines.push(d.rowsPreview || '--');
  }
  ui.diagText.textContent = lines.join('\n');
}

function formatDate(timestamp) {
  if (!timestamp) return '--';
  try {
    return new Date(timestamp).toLocaleString('pt-BR');
  } catch (e) {
    return '--';
  }
}

function renderConferencia(state) {
  const conferencia = state.conferencia || HubState.defaultConferencia();

  ui.radioDocOrcamento.checked = conferencia.tipoDocumento === 'orcamento';
  ui.radioDocNfe.checked = conferencia.tipoDocumento === 'nfe';
  ui.docOrcamentoHint.hidden = conferencia.tipoDocumento !== 'orcamento';

  ui.conferenciaChecklist.innerHTML = '';
  CONFERENCIA_CHECKLIST_ITEMS.forEach((item) => {
    const checked = !!conferencia.checklist[item.key];
    const li = document.createElement('li');
    const inputId = `chk-conf-${item.key}`;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = inputId;
    input.checked = checked;
    input.addEventListener('change', (e) => onChecklistChange(item.key, e.target.checked));
    const label = document.createElement('label');
    label.setAttribute('for', inputId);
    label.textContent = item.label;
    li.appendChild(input);
    li.appendChild(label);
    ui.conferenciaChecklist.appendChild(li);
  });

  const divergencias = conferencia.divergencias || [];
  ui.divergenciasLista.innerHTML = '';
  if (divergencias.length === 0) {
    const li = document.createElement('li');
    li.className = 'divergencia-empty';
    li.textContent = 'Nenhuma divergência registrada.';
    ui.divergenciasLista.appendChild(li);
  } else {
    divergencias.forEach((dvg, idx) => {
      const li = document.createElement('li');
      const parts = [dvg.item || '(item não informado)', `pedido: ${dvg.valorPedido || '--'}`, `recebido: ${dvg.valorRecebido || '--'}`];
      if (dvg.observacao) parts.push(dvg.observacao);
      const span = document.createElement('span');
      span.textContent = parts.join(' · ');
      const btn = document.createElement('button');
      btn.className = 'divergencia-remove';
      btn.title = 'Remover';
      btn.textContent = '×';
      btn.addEventListener('click', () => onRemoveDivergencia(idx));
      li.appendChild(span);
      li.appendChild(btn);
      ui.divergenciasLista.appendChild(li);
    });
  }

  const allChecked = CONFERENCIA_CHECKLIST_ITEMS.every((item) => !!conferencia.checklist[item.key]);
  const hasDivergencias = divergencias.length > 0;

  ui.btnAprovarConferencia.disabled = !allChecked || conferencia.aprovado === true;

  ui.conferenciaStatus.className = 'conferencia-status';
  if (conferencia.aprovado === true) {
    ui.conferenciaStatus.classList.add('status-aprovado');
    ui.conferenciaStatus.textContent = hasDivergencias
      ? `Conferência aprovada em ${formatDate(conferencia.dataConferencia)} — ${divergencias.length} divergência(s) registrada(s) para repassar ao financeiro.`
      : `Conferência aprovada em ${formatDate(conferencia.dataConferencia)}.`;
  } else {
    ui.conferenciaStatus.classList.add('status-pendente');
    if (!allChecked) {
      ui.conferenciaStatus.textContent = 'Conferência pendente.';
    } else {
      ui.conferenciaStatus.textContent = hasDivergencias
        ? 'Checklist completo, com divergência(s) registrada(s) — pronto para aprovar.'
        : 'Checklist completo — pronto para aprovar.';
    }
  }
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

ui.inputSheetUrl.addEventListener('focus', () => { sheetUrlInputFocused = true; });
ui.inputSheetUrl.addEventListener('blur', () => {
  sheetUrlInputFocused = false;
  const url = ui.inputSheetUrl.value.trim();
  send(TYPES.SAVE_SHEET_URL, { url }, 'sidebar').then(refresh);
});

function saveBessaniPrintFromBlob(blob) {
  const reader = new FileReader();
  reader.onload = () => {
    send(TYPES.SAVE_BESSANI_PRINT, { dataUrl: reader.result }, 'sidebar').then(refresh);
  };
  reader.readAsDataURL(blob);
}

ui.printDropzone.addEventListener('paste', (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type && item.type.indexOf('image') !== -1) {
      e.preventDefault();
      const blob = item.getAsFile();
      if (blob) saveBessaniPrintFromBlob(blob);
      return;
    }
  }
});

ui.inputPrintUpload.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) saveBessaniPrintFromBlob(file);
});

ui.btnRemoverPrint.addEventListener('click', () => {
  send(TYPES.SAVE_BESSANI_PRINT, { dataUrl: null }, 'sidebar').then(refresh);
});

async function updateConferencia(mutator) {
  const state = await HubState.getState();
  const conferencia = JSON.parse(JSON.stringify(state.conferencia || HubState.defaultConferencia()));
  mutator(conferencia);
  await send(TYPES.SAVE_CONFERENCIA, { conferencia }, 'sidebar');
  refresh();
}

function onChecklistChange(key, checked) {
  updateConferencia((c) => {
    c.checklist[key] = checked;
    c.aprovado = null;
  });
}

ui.radioDocOrcamento.addEventListener('change', () => {
  if (ui.radioDocOrcamento.checked) updateConferencia((c) => { c.tipoDocumento = 'orcamento'; });
});
ui.radioDocNfe.addEventListener('change', () => {
  if (ui.radioDocNfe.checked) updateConferencia((c) => { c.tipoDocumento = 'nfe'; });
});

ui.btnAddDivergencia.addEventListener('click', () => {
  const item = ui.inputDivItem.value.trim();
  const valorPedido = ui.inputDivPedido.value.trim();
  const valorRecebido = ui.inputDivRecebido.value.trim();
  const observacao = ui.inputDivObs.value.trim();
  if (!item) {
    ui.inputDivItem.focus();
    return;
  }
  const pedidoNum = parseFloat(valorPedido.replace(',', '.'));
  const recebidoNum = parseFloat(valorRecebido.replace(',', '.'));
  const diferenca = !isNaN(pedidoNum) && !isNaN(recebidoNum) ? (recebidoNum - pedidoNum).toFixed(2) : '';
  updateConferencia((c) => {
    c.divergencias.push({ item, valorPedido, valorRecebido, diferenca, observacao });
    c.aprovado = null;
  });
  ui.inputDivItem.value = '';
  ui.inputDivPedido.value = '';
  ui.inputDivRecebido.value = '';
  ui.inputDivObs.value = '';
});

function onRemoveDivergencia(idx) {
  updateConferencia((c) => {
    c.divergencias.splice(idx, 1);
    c.aprovado = null;
  });
}

function aprovarConferencia() {
  updateConferencia((c) => {
    c.aprovado = true;
    c.dataConferencia = Date.now();
  });
}

ui.btnAprovarConferencia.addEventListener('click', async () => {
  const state = await HubState.getState();
  const divergencias = (state.conferencia && state.conferencia.divergencias) || [];
  if (divergencias.length > 0) {
    ui.conferenciaConfirmText.textContent =
      `Há ${divergencias.length} divergência(s) registrada(s). Confirma aprovar o pedido mesmo assim? ` +
      'As divergências continuam registradas aqui para repassar ao financeiro.';
    ui.conferenciaConfirmWrap.hidden = false;
    ui.btnAprovarConferencia.hidden = true;
    return;
  }
  aprovarConferencia();
});

ui.btnConfirmarAprovarConferencia.addEventListener('click', () => {
  ui.conferenciaConfirmWrap.hidden = true;
  ui.btnAprovarConferencia.hidden = false;
  aprovarConferencia();
});

ui.btnCancelarAprovarConferencia.addEventListener('click', () => {
  ui.conferenciaConfirmWrap.hidden = true;
  ui.btnAprovarConferencia.hidden = false;
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
