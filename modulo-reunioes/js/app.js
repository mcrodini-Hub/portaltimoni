// Lógica principal do Módulo Reuniões: navegação entre abas, formulário de
// agendamento, listagem de próximas/passadas reuniões e registro de atas.

const el = (id) => document.getElementById(id);

const ui = {
  btnSignin: el('btn-signin'),
  btnSignout: el('btn-signout'),
  signedOutNotice: el('signed-out-notice'),
  app: el('app'),

  tabButtons: document.querySelectorAll('.tab-btn'),
  tabPanels: document.querySelectorAll('.tab-panel'),

  formAgendar: el('form-agendar'),
  inputTitulo: el('input-titulo'),
  inputInicio: el('input-inicio'),
  inputFim: el('input-fim'),
  inputLocal: el('input-local'),
  inputPauta: el('input-pauta'),
  inputParticipantes: el('input-participantes'),
  agendarFeedback: el('agendar-feedback'),

  listaProximas: el('lista-proximas'),
  proximasVazio: el('proximas-vazio'),
  listaHistorico: el('lista-historico'),
  historicoVazio: el('historico-vazio'),

  modalAta: el('modal-ata'),
  formAta: el('form-ata'),
  ataReuniaoTitulo: el('ata-reuniao-titulo'),
  inputDecisoes: el('input-decisoes'),
  btnCancelarAta: el('btn-cancelar-ata')
};

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value === undefined || value === null ? '' : String(value);
  return div.innerHTML;
}

function formatDataHora(dateTimeStr) {
  if (!dateTimeStr) return '--';
  const d = new Date(dateTimeStr);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function participantesDoEvento(evento) {
  return (evento.attendees || []).map((a) => a.email);
}

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

function onAuthChange(signedIn) {
  ui.btnSignin.hidden = signedIn;
  ui.btnSignout.hidden = !signedIn;
  ui.signedOutNotice.hidden = signedIn;
  ui.app.hidden = !signedIn;
  if (signedIn) {
    carregarProximas();
    carregarHistorico();
  }
}

ui.btnSignin.addEventListener('click', () => ReuniõesAuth.signIn());
ui.btnSignout.addEventListener('click', () => ReuniõesAuth.signOut());

// ---------------------------------------------------------------------------
// Navegação entre abas
// ---------------------------------------------------------------------------

ui.tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    ui.tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
    const tab = btn.dataset.tab;
    ui.tabPanels.forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${tab}`));
  });
});

// ---------------------------------------------------------------------------
// Agendar reunião
// ---------------------------------------------------------------------------

function mostrarFeedbackAgendar(mensagem, tipo) {
  ui.agendarFeedback.hidden = false;
  ui.agendarFeedback.textContent = mensagem;
  ui.agendarFeedback.className = `feedback ${tipo}`;
}

ui.formAgendar.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = ui.formAgendar.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const participantes = ui.inputParticipantes.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    await ReuniõesCalendar.createMeeting({
      titulo: ui.inputTitulo.value.trim(),
      inicio: new Date(ui.inputInicio.value).toISOString(),
      fim: new Date(ui.inputFim.value).toISOString(),
      local: ui.inputLocal.value.trim(),
      pauta: ui.inputPauta.value.trim(),
      participantes
    });

    mostrarFeedbackAgendar('Reunião agendada com sucesso!', 'ok');
    ui.formAgendar.reset();
    carregarProximas();
  } catch (err) {
    console.error(err);
    mostrarFeedbackAgendar(`Erro ao agendar reunião: ${err.message}`, 'erro');
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Listagem de reuniões (próximas e histórico)
// ---------------------------------------------------------------------------

function renderReuniaoCard(evento, ata) {
  const li = document.createElement('li');
  li.className = 'reuniao-card';

  const participantes = participantesDoEvento(evento);
  const inicio = evento.start && (evento.start.dateTime || evento.start.date);

  li.innerHTML = `
    <div class="reuniao-titulo">${escapeHtml(evento.summary || '(sem título)')}</div>
    <div class="reuniao-meta">${escapeHtml(formatDataHora(inicio))}${evento.location ? ' · ' + escapeHtml(evento.location) : ''}</div>
    <div class="reuniao-participantes">${participantes.length ? 'Participantes: ' + escapeHtml(participantes.join(', ')) : 'Sem participantes registrados'}</div>
  `;

  if (ata) {
    const ataDiv = document.createElement('div');
    ataDiv.className = 'reuniao-ata';
    ataDiv.textContent = ata.decisoes;
    li.appendChild(ataDiv);
  }

  const btnAta = document.createElement('button');
  btnAta.className = 'btn btn-secondary';
  btnAta.textContent = ata ? 'Editar ata' : 'Registrar ata';
  btnAta.addEventListener('click', () => abrirModalAta(evento, ata));
  li.appendChild(btnAta);

  return li;
}

async function carregarProximas() {
  try {
    const eventos = await ReuniõesCalendar.listUpcoming();
    const atas = await ReuniõesSheets.listAtasByEventId();
    ui.listaProximas.innerHTML = '';
    ui.proximasVazio.hidden = eventos.length > 0;
    eventos.forEach((evento) => {
      ui.listaProximas.appendChild(renderReuniaoCard(evento, atas[evento.id]));
    });
  } catch (err) {
    console.error('Erro ao carregar próximas reuniões:', err);
  }
}

async function carregarHistorico() {
  try {
    const eventos = await ReuniõesCalendar.listPast();
    const atas = await ReuniõesSheets.listAtasByEventId();
    ui.listaHistorico.innerHTML = '';
    ui.historicoVazio.hidden = eventos.length > 0;
    eventos.forEach((evento) => {
      ui.listaHistorico.appendChild(renderReuniaoCard(evento, atas[evento.id]));
    });
  } catch (err) {
    console.error('Erro ao carregar histórico:', err);
  }
}

// ---------------------------------------------------------------------------
// Modal de registro de ata
// ---------------------------------------------------------------------------

let eventoAtaAtual = null;

function abrirModalAta(evento, ata) {
  eventoAtaAtual = evento;
  ui.ataReuniaoTitulo.textContent = evento.summary || '(sem título)';
  ui.inputDecisoes.value = ata ? ata.decisoes : '';
  ui.modalAta.showModal();
}

ui.btnCancelarAta.addEventListener('click', () => {
  ui.modalAta.close();
});

ui.formAta.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = ui.formAta.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const evento = eventoAtaAtual;
    const inicio = evento.start && (evento.start.dateTime || evento.start.date);
    await ReuniõesSheets.appendAta({
      eventId: evento.id,
      dataReuniao: formatDataHora(inicio),
      titulo: evento.summary || '',
      participantes: participantesDoEvento(evento),
      decisoes: ui.inputDecisoes.value.trim()
    });
    ui.modalAta.close();
    carregarProximas();
    carregarHistorico();
  } catch (err) {
    console.error(err);
    window.alert(`Erro ao salvar ata: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------

function iniciar() {
  if (typeof google === 'undefined' || !google.accounts) {
    setTimeout(iniciar, 100);
    return;
  }
  ReuniõesAuth.init(onAuthChange);
}

document.addEventListener('DOMContentLoaded', iniciar);
