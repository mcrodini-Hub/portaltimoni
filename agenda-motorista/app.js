// Agenda de Motorista — Portal Timoni
// Lógica da interface: calendário, dia, formulário de viagem, relatório e rota.
// Dados via AgendaStore (lib/store.js — planilha compartilhada ou localStorage local).
// Tudo fica numa tela só (dashboard): calendário + viagens do dia + formulário.

let mesAtual = { ano: 0, mes: 0 };
let modoCalendario = 'semana';
let semanaAtualInicio = null;
let diaAtual = null;
let viagensDia = [];
let filtroLoja = 'todas';
let editandoId = null;
let notaCount = 0;
let toastTimer = null;
let diaMotorista = null;

// --------------------------------------------------------------------------
// Utilidades
// --------------------------------------------------------------------------
function mostrarToast(mensagem, tipo) {
  const el = document.getElementById('toast');
  el.textContent = mensagem;
  el.className = 'toast mostrar' + (tipo === 'erro' ? ' erro' : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('mostrar');
    setTimeout(() => { el.hidden = true; }, 250);
  }, 2600);
}

function voltarAoTopo() {
  document.getElementById('topoConteudo').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function nonEmptyLines(text) {
  return (text || '').split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) { return escHtml(s).replace(/"/g, '&quot;'); }

function toDataStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekdayLabel(dataStr) {
  const [y, m, d] = dataStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return ['dom', '2ªf', '3ªf', '4ªf', '5ªf', '6ªf', 'sáb'][dt.getDay()];
}

function formatDataLine(dataStr) {
  const [, m, d] = dataStr.split('-');
  return `${d}/${m} - ${weekdayLabel(dataStr)}`;
}

function formatDataTitulo(dataStr) {
  const [y, m, d] = dataStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  return `${dias[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

// Parse local (não usar `new Date("YYYY-MM-DD")` direto — isso é interpretado como UTC e pode
// virar o dia errado dependendo do fuso do navegador).
function dataStrParaDate(dataStr) {
  const [y, m, d] = dataStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatHoraCurta(iso) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function statusPillHtml(v) {
  if (v.tipoHorario === 'Bloqueio') return '';
  if (v.checkoutEm) return `<span class="status-pill status-concluida">✓ Concluída ${formatHoraCurta(v.checkoutEm)}</span>`;
  if (v.checkinEm) return `<span class="status-pill status-andamento">No local desde ${formatHoraCurta(v.checkinEm)}</span>`;
  return '<span class="status-pill status-pendente">Pendente</span>';
}

// Padrão fixo: segunda à tarde, quarta e sexta o motorista vai para Araras (entregas maiores).
// É só um lembrete visual — não bloqueia nem impede registrar outra coisa nesses dias.
function padraoAraras(dataStr) {
  const [y, m, d] = dataStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  if (dow === 1) return 'Araras (tarde)';
  if (dow === 3 || dow === 5) return 'Araras';
  return null;
}

function paraMinutos(horario) {
  if (!horario || !horario.includes(':')) return null;
  const [h, m] = horario.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function formatTime(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes(':')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;
  if (digits.length <= 2) return `${digits}:00`;
  if (digits.length === 3) return `${digits.slice(0, 1)}:${digits.slice(1)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

function formatPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (digits.length <= 10) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

// --------------------------------------------------------------------------
// Navegação (só duas telas: a agenda em si, e a configuração da planilha)
// --------------------------------------------------------------------------
function mostrarTela(nome) {
  ['telaConfig', 'telaAgenda', 'telaMotorista'].forEach((id) => {
    document.getElementById(id).hidden = id !== nome;
  });
}

async function init() {
  const hoje = new Date();
  mesAtual = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  semanaAtualInicio = segundaDaSemana(hoje);
  mostrarTela('telaAgenda');
  refrescarCalendario();
  abrirDia(toDataStr(hoje)); // já abre o dia de hoje, sem precisar clicar em nada
}

function refrescarCalendario() {
  if (modoCalendario === 'semana') renderSemana();
  else renderCalendario();
  renderListaSemanal();
}

// --------------------------------------------------------------------------
// Calendário — visão Semana (padrão) e visão Mês
// --------------------------------------------------------------------------
const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_UTEIS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];

function segundaDaSemana(data) {
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const dow = d.getDay(); // 0=dom..6=sáb
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
}

function diasDaSemana() {
  const dias = [];
  for (let i = 0; i < DIAS_UTEIS.length; i++) {
    const d = new Date(semanaAtualInicio);
    d.setDate(d.getDate() + i);
    dias.push(d);
  }
  return dias;
}

function labelSemana(dias) {
  const ini = dias[0];
  const fim = dias[dias.length - 1];
  const nomeIni = NOMES_MES[ini.getMonth()].toLowerCase();
  const nomeFim = NOMES_MES[fim.getMonth()].toLowerCase();
  if (ini.getMonth() === fim.getMonth() && ini.getFullYear() === fim.getFullYear()) {
    return `${ini.getDate()} a ${fim.getDate()} de ${nomeIni} ${ini.getFullYear()}`;
  }
  return `${ini.getDate()} de ${nomeIni} a ${fim.getDate()} de ${nomeFim} de ${fim.getFullYear()}`;
}

function rotuloItemDia(v) {
  if (v.tipoHorario === 'Bloqueio') return `${v.horario || '--:--'} · 🔒 ${v.info || 'Bloqueio'}`;
  return `${v.horario || '--:--'} · ${v.clienteFornecedor || v.tipoHorario}`;
}

async function renderSemana() {
  const dias = diasDaSemana();
  document.getElementById('calLabel').textContent = labelSemana(dias);

  let listasPorDia;
  try {
    listasPorDia = await Promise.all(dias.map((d) => AgendaStore.listarDia(toDataStr(d))));
  } catch (e) {
    document.getElementById('calMsg').textContent = e.message;
    return;
  }
  document.getElementById('calMsg').textContent = '';

  const hojeStr = toDataStr(new Date());
  const diaSelecionado = diaAtual;
  const grid = document.getElementById('calGridSemana');
  grid.innerHTML = '';

  dias.forEach((d, idx) => {
    const dataStr = toDataStr(d);
    const viagens = listasPorDia[idx];
    const tag = padraoAraras(dataStr);
    const col = document.createElement('div');
    col.className = 'week-day' + (dataStr === hojeStr ? ' hoje' : '') + (dataStr === diaSelecionado ? ' selecionado' : '');
    const itensHtml = viagens.slice(0, 4).map((v) => `<div class="week-day-item ${v.tipoHorario === 'Retirada' ? 'retirada' : (v.tipoHorario === 'Bloqueio' ? 'bloqueio' : 'entrega')}">${escHtml(rotuloItemDia(v))}</div>`).join('');
    const maisHtml = viagens.length > 4 ? `<div class="week-day-mais">+${viagens.length - 4} mais</div>` : '';
    col.innerHTML = `
      <div class="week-day-header">
        <span class="week-day-dow">${DIAS_UTEIS[idx]}</span>
        <span class="week-day-num">${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}</span>
      </div>
      ${tag ? `<span class="cal-day-tag">${tag}</span>` : ''}
      ${viagens.length ? itensHtml + maisHtml : '<span class="week-day-empty">Sem viagens</span>'}
    `;
    col.addEventListener('click', () => abrirDia(dataStr));
    grid.appendChild(col);
  });
}

async function renderListaSemanal() {
  const dias = diasDaSemana();
  let listasPorDia;
  try {
    listasPorDia = await Promise.all(dias.map((d) => AgendaStore.listarDia(toDataStr(d))));
  } catch (e) {
    return;
  }

  const container = document.getElementById('agendaListaSemana');
  container.innerHTML = '';
  let algumaViagem = false;

  dias.forEach((d, idx) => {
    const viagens = listasPorDia[idx];
    if (!viagens.length) return;
    algumaViagem = true;
    const dataStr = toDataStr(d);

    const grupo = document.createElement('div');
    grupo.className = 'agenda-lista-dia';
    const titulo = document.createElement('p');
    titulo.className = 'agenda-lista-dia-titulo';
    titulo.textContent = `${DIAS_UTEIS[idx]} ${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    grupo.appendChild(titulo);

    viagens.forEach((v) => {
      const isBloqueio = v.tipoHorario === 'Bloqueio';
      const item = document.createElement('div');
      item.className = 'agenda-lista-item';
      item.innerHTML = `
        <span class="viagem-horario">${escHtml(v.horario) || '--:--'}</span>
        <span class="tag ${v.tipoHorario === 'Retirada' ? 'tag-retirada' : (isBloqueio ? 'tag-bloqueio' : 'tag-entrega')}">${isBloqueio ? '🔒' : escHtml(v.tipoHorario)}</span>
        <span class="tag tag-loja">${escHtml(AgendaStore.LOJA_LABEL[v.loja] || v.loja)}</span>
        <span class="agenda-lista-desc">${isBloqueio ? escHtml(v.info) || 'Bloqueio' : escHtml(v.clienteFornecedor) || '(sem cliente/fornecedor)'}</span>
      `;
      item.addEventListener('click', () => abrirDia(dataStr));
      grupo.appendChild(item);
    });
    container.appendChild(grupo);
  });

  if (!algumaViagem) {
    container.innerHTML = '<p class="hint-text">Nenhuma viagem agendada nesta semana.</p>';
  }
}

async function renderCalendario() {
  document.getElementById('calLabel').textContent = `${NOMES_MES[mesAtual.mes - 1]} ${mesAtual.ano}`;
  let resumo = {};
  try {
    resumo = await AgendaStore.listarMes(mesAtual.ano, mesAtual.mes);
  } catch (e) {
    document.getElementById('calMsg').textContent = e.message;
    return;
  }
  document.getElementById('calMsg').textContent = '';

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach((w) => {
    const el = document.createElement('div');
    el.className = 'cal-weekday';
    el.textContent = w;
    grid.appendChild(el);
  });

  const primeiroDia = new Date(mesAtual.ano, mesAtual.mes - 1, 1);
  const inicioGrid = new Date(primeiroDia);
  inicioGrid.setDate(inicioGrid.getDate() - primeiroDia.getDay());
  const hojeStr = toDataStr(new Date());

  for (let i = 0; i < 42; i++) {
    const d = new Date(inicioGrid);
    d.setDate(inicioGrid.getDate() + i);
    const dataStr = toDataStr(d);
    const foraMes = d.getMonth() !== mesAtual.mes - 1;
    const tag = padraoAraras(dataStr);
    const info = resumo[dataStr];

    const cel = document.createElement('div');
    cel.className = 'cal-day' + (foraMes ? ' fora-mes' : '') + (dataStr === hojeStr ? ' hoje' : '') + (dataStr === diaAtual ? ' selecionado' : '');
    cel.innerHTML = `
      <span class="cal-day-num">${d.getDate()}</span>
      ${tag ? `<span class="cal-day-tag">${tag}</span>` : ''}
      ${info ? `<div class="cal-day-counts">
        ${info.entregas ? `<span class="cal-count"><span class="dot dot-entrega"></span>${info.entregas}</span>` : ''}
        ${info.retiradas ? `<span class="cal-count"><span class="dot dot-retirada"></span>${info.retiradas}</span>` : ''}
        ${info.bloqueios ? `<span class="cal-count"><span class="dot dot-bloqueio"></span>${info.bloqueios}</span>` : ''}
      </div>` : ''}
    `;
    cel.addEventListener('click', () => abrirDia(dataStr));
    grid.appendChild(cel);
  }
}

// --------------------------------------------------------------------------
// Dia (mostrado abaixo do calendário, na mesma tela)
// --------------------------------------------------------------------------
async function abrirDia(data) {
  diaAtual = data;
  filtroLoja = 'todas';
  fecharForm();
  document.getElementById('diaValidationMsg').textContent = '';
  atualizarChipsFiltro();
  await carregarDia();
  refrescarCalendario();
}

function atualizarChipsFiltro() {
  document.querySelectorAll('.js-filtro-loja').forEach((b) => b.classList.toggle('ativo', b.dataset.loja === filtroLoja));
}

async function carregarDia(destacarId) {
  try {
    viagensDia = await AgendaStore.listarDia(diaAtual);
  } catch (e) {
    document.getElementById('diaValidationMsg').textContent = e.message;
    viagensDia = [];
  }
  renderDia(destacarId);
}

// Qualquer viagem com horário final ("Até") define um período bloqueado — não só Retirada.
function calcularConflitos(viagens) {
  const blocos = viagens.filter((v) => v.horario && v.horarioFim);
  return viagens.map((v) => {
    const inicioV = paraMinutos(v.horario);
    if (inicioV === null) return null;
    for (const b of blocos) {
      if (b === v) continue;
      const inicioB = paraMinutos(b.horario);
      const fimB = paraMinutos(b.horarioFim);
      if (inicioB === null || fimB === null) continue;
      if (inicioV >= inicioB && inicioV < fimB) {
        const rotulo = b.tipoHorario === 'Bloqueio' ? 'bloqueio' : b.tipoHorario.toLowerCase();
        return `Conflita com ${rotulo} das ${b.horario} às ${b.horarioFim}${b.info ? ' (' + b.info + ')' : ''}`;
      }
    }
    return null;
  });
}

function renderDia(destacarId) {
  document.getElementById('diaTitulo').textContent = formatDataTitulo(diaAtual);
  const tag = padraoAraras(diaAtual);
  const banner = document.getElementById('diaBanner');
  if (tag) {
    banner.hidden = false;
    banner.textContent = `📍 Dia padrão de ${tag} — confira o roteiro antes de fechar a agenda.`;
  } else {
    banner.hidden = true;
  }

  const podeReordenar = filtroLoja === 'todas';
  const filtradas = podeReordenar ? viagensDia : viagensDia.filter((v) => v.loja === filtroLoja);
  const conflitos = calcularConflitos(filtradas);

  const lista = document.getElementById('listaViagens');
  lista.innerHTML = '';
  if (!filtradas.length) {
    lista.innerHTML = `<p class="hint-text">Nenhuma viagem cadastrada${filtroLoja !== 'todas' ? ' para esta loja' : ''} neste dia.</p>`;
  }

  filtradas.forEach((v, idx) => {
    const isBloqueio = v.tipoHorario === 'Bloqueio';
    const enderecoResumo = [v.endereco, v.numero].filter(Boolean).join(', ');
    const card = document.createElement('div');
    card.className = 'viagem-card' + (isBloqueio ? ' viagem-bloqueio' : '');
    card.id = 'viagem-' + v.id;
    const tagTipo = v.tipoHorario === 'Retirada' ? 'tag-retirada' : (isBloqueio ? 'tag-bloqueio' : 'tag-entrega');
    card.innerHTML = `
      <div class="viagem-linha">
        <div class="viagem-mover">
          <button class="icon-btn" data-mover="-1" data-id="${v.id}" title="Mover para cima" ${!podeReordenar || idx === 0 ? 'disabled' : ''}>▲</button>
          <button class="icon-btn" data-mover="1" data-id="${v.id}" title="Mover para baixo" ${!podeReordenar || idx === filtradas.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
        <div style="flex:1;min-width:0;">
          <div class="viagem-topo">
            <span class="viagem-horario">${escHtml(v.horario) || '--:--'}</span>
            <span class="tag ${tagTipo}">${isBloqueio ? '🔒 Bloqueio' : escHtml(v.tipoHorario)}</span>
            <span class="tag tag-loja">${escHtml(AgendaStore.LOJA_LABEL[v.loja] || v.loja)}</span>
            ${v.horarioFim ? `<span class="tag tag-loja">até ${escHtml(v.horarioFim)}</span>` : ''}
            ${statusPillHtml(v)}
          </div>
          ${isBloqueio
            ? `<p class="viagem-resumo">${escHtml(v.info) || '(sem motivo informado)'}</p>`
            : `<p class="viagem-resumo"><strong>${escHtml(v.clienteFornecedor) || '(sem cliente/fornecedor)'}</strong>${v.numeroPedido ? ` — ${escHtml(v.numeroPedido)}` : ''}</p>
               <p class="viagem-sub">${escHtml(enderecoResumo) || 'Endereço não informado'}</p>`}
          ${conflitos[idx] ? `<p class="viagem-conflito">⚠ ${escHtml(conflitos[idx])}</p>` : ''}
          <div class="viagem-acoes">
            <button class="btn-outline btn-small js-editar" data-id="${v.id}">Editar</button>
            <button class="btn-secondary btn-small js-duplicar" data-id="${v.id}">Duplicar</button>
            <button class="btn-secondary btn-small js-copiar" data-id="${v.id}">Copiar texto</button>
            <button class="btn-secondary btn-small js-imprimir" data-id="${v.id}">Imprimir</button>
            <button class="btn-danger btn-small js-excluir" data-id="${v.id}">Excluir</button>
          </div>
        </div>
      </div>
    `;
    lista.appendChild(card);
  });

  lista.querySelectorAll('[data-mover]').forEach((btn) => btn.addEventListener('click', () => moverViagem(btn.dataset.id, Number(btn.dataset.mover))));
  lista.querySelectorAll('.js-editar').forEach((btn) => btn.addEventListener('click', () => abrirForm(viagensDia.find((x) => x.id === btn.dataset.id))));
  lista.querySelectorAll('.js-excluir').forEach((btn) => btn.addEventListener('click', () => excluirItem(btn.dataset.id)));
  lista.querySelectorAll('.js-duplicar').forEach((btn) => btn.addEventListener('click', () => duplicarViagem(btn.dataset.id)));
  lista.querySelectorAll('.js-copiar').forEach((btn) => btn.addEventListener('click', () => copiarViagemIndividual(btn.dataset.id)));
  lista.querySelectorAll('.js-imprimir').forEach((btn) => btn.addEventListener('click', () => imprimirViagemIndividual(btn.dataset.id)));

  if (destacarId) {
    const cardDestacado = document.getElementById('viagem-' + destacarId);
    if (cardDestacado) {
      cardDestacado.classList.add('destaque');
      cardDestacado.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => cardDestacado.classList.remove('destaque'), 3500);
    }
  }

  renderOutput();
}

async function moverViagem(id, direcao) {
  const idx = viagensDia.findIndex((v) => v.id === id);
  const novoIdx = idx + direcao;
  if (idx === -1 || novoIdx < 0 || novoIdx >= viagensDia.length) return;
  const arr = viagensDia.slice();
  [arr[idx], arr[novoIdx]] = [arr[novoIdx], arr[idx]];
  viagensDia = arr;
  renderDia();
  try {
    await AgendaStore.reordenarDia(diaAtual, arr.map((v) => v.id));
  } catch (e) {
    document.getElementById('diaValidationMsg').textContent = e.message;
  }
}

async function excluirItem(id) {
  if (!confirm('Excluir esta viagem da agenda?')) return;
  try {
    await AgendaStore.excluirViagem(id, diaAtual);
    await carregarDia();
    refrescarCalendario();
    mostrarToast('Viagem excluída');
  } catch (e) {
    document.getElementById('diaValidationMsg').textContent = e.message;
    mostrarToast('Não foi possível excluir: ' + e.message, 'erro');
  }
}

// --------------------------------------------------------------------------
// Formulário (criar / editar viagem)
// --------------------------------------------------------------------------
function toggleTipoCampos() {
  const tipo = document.getElementById('f-tipoHorario').value;
  document.getElementById('camposEntrega').style.display = tipo === 'Bloqueio' ? 'none' : 'block';
  document.getElementById('f-endereco-req').hidden = tipo === 'Bloqueio';
  const precisaAte = tipo === 'Retirada' || tipo === 'Bloqueio';
  document.getElementById('f-horarioFim-req').hidden = !precisaAte;
}

function toggleNotas(autoAddTwo) {
  const checked = document.getElementById('f-dividir').checked;
  document.getElementById('notasContainer').style.display = checked ? 'block' : 'none';
  document.getElementById('addNotaBtn').style.display = checked ? 'inline-block' : 'none';
  if (checked && autoAddTwo && document.getElementById('notasContainer').children.length === 0) {
    addNota('', '');
    addNota('', '');
  }
}

function addNota(nome, itensTexto) {
  notaCount++;
  const nid = notaCount;
  const container = document.getElementById('notasContainer');
  const div = document.createElement('div');
  div.className = 'nota-block';
  div.id = 'nota-' + nid;
  div.innerHTML = `
    <label>Nome da empresa <button type="button" class="remove-nota" data-nid="${nid}">remover</button></label>
    <input type="text" class="n-nome" placeholder="Ex: Casa Timoni" value="${escAttr(nome || '')}">
    <label>Itens (um por linha)</label>
    <textarea class="n-itens" placeholder="Ex: 3 rolos de 150g">${escHtml(itensTexto || '')}</textarea>
  `;
  container.appendChild(div);
  div.querySelector('.remove-nota').addEventListener('click', () => div.remove());
}

function resetForm() {
  document.getElementById('f-data').value = diaAtual;
  document.getElementById('f-loja').value = '';
  document.getElementById('f-tipoHorario').value = 'Entrega';
  document.getElementById('f-horario').value = '';
  document.getElementById('f-horarioFim').value = '';
  document.getElementById('f-cep').value = '';
  document.getElementById('cepMsg').textContent = '';
  document.getElementById('f-endereco').value = '';
  document.getElementById('f-numero').value = '';
  document.getElementById('f-complemento').value = '';
  document.getElementById('f-clienteFornecedor').value = '';
  document.getElementById('f-numeroPedido').value = '';
  document.getElementById('f-itens').value = '';
  document.getElementById('f-contatoNome').value = '';
  document.getElementById('f-contatoWhats').value = '';
  document.getElementById('f-volumes').value = '';
  document.getElementById('f-info').value = '';
  document.getElementById('f-preenchidoPor').value = '';
  document.getElementById('f-dividir').checked = false;
  document.getElementById('notasContainer').innerHTML = '';
  toggleNotas(false);
  toggleTipoCampos();
  document.getElementById('formValidationMsg').textContent = '';
  document.querySelectorAll('#formPanel .field-error').forEach((el) => el.classList.remove('field-error'));
}

function preencherCampos(viagem) {
  document.getElementById('f-data').value = viagem.data;
  document.getElementById('f-loja').value = viagem.loja;
  document.getElementById('f-tipoHorario').value = viagem.tipoHorario;
  document.getElementById('f-horario').value = viagem.horario;
  document.getElementById('f-horarioFim').value = viagem.horarioFim || '';
  document.getElementById('f-endereco').value = viagem.endereco;
  document.getElementById('f-numero').value = viagem.numero;
  document.getElementById('f-complemento').value = viagem.complemento;
  document.getElementById('f-clienteFornecedor').value = viagem.clienteFornecedor;
  document.getElementById('f-numeroPedido').value = viagem.numeroPedido;
  document.getElementById('f-itens').value = viagem.itens;
  document.getElementById('f-contatoNome').value = viagem.contatoNome;
  document.getElementById('f-contatoWhats').value = viagem.contatoWhats;
  document.getElementById('f-volumes').value = viagem.volumes;
  document.getElementById('f-info').value = viagem.info;
  document.getElementById('f-preenchidoPor').value = viagem.preenchidoPor;
  document.getElementById('f-dividir').checked = !!viagem.dividir;
  toggleTipoCampos();
  toggleNotas(false);
  (viagem.notas || []).forEach((n) => addNota(n.nome, n.itens));
}

function abrirForm(viagem) {
  resetForm();
  editandoId = viagem ? viagem.id : null;
  document.getElementById('formTitulo').textContent = viagem ? 'Editar viagem' : 'Nova viagem';
  document.getElementById('btnExcluirNoForm').hidden = !viagem;
  if (viagem) preencherCampos(viagem);
  document.getElementById('formOverlay').hidden = false;
}

// Copia os dados de uma viagem existente para um formulário de viagem NOVA — agiliza
// cadastrar algo parecido (mesmo cliente/endereço). O horário fica em branco de propósito,
// pra forçar escolher um novo e não repetir sem querer o mesmo horário duas vezes.
function duplicarViagem(id) {
  const v = viagensDia.find((x) => x.id === id);
  if (!v) return;
  resetForm();
  editandoId = null;
  document.getElementById('formTitulo').textContent = 'Nova viagem (duplicada)';
  document.getElementById('btnExcluirNoForm').hidden = true;
  preencherCampos(v);
  document.getElementById('f-horario').value = '';
  document.getElementById('f-horarioFim').value = '';
  document.getElementById('formOverlay').hidden = false;
  document.getElementById('f-horario').focus();
}

function copiarViagemIndividual(id) {
  const v = viagensDia.find((x) => x.id === id);
  if (!v) return;
  const texto = buildTripText(v, true);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(() => mostrarToast('Texto da viagem copiado ✓')).catch(() => mostrarToast('Não foi possível copiar.', 'erro'));
  } else {
    const tmp = document.createElement('textarea');
    tmp.value = texto;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    tmp.remove();
    mostrarToast('Texto da viagem copiado ✓');
  }
}

function imprimirViagemIndividual(id) {
  const v = viagensDia.find((x) => x.id === id);
  if (!v) return;
  printText(buildTripText(v, true));
}

function fecharForm() {
  document.getElementById('formOverlay').hidden = true;
  editandoId = null;
}

// Só data, loja e preenchido por são sempre obrigatórios. Endereço só entra se não for
// bloqueio. "Até" só é obrigatório em Retirada/Bloqueio (é o que define o período preso).
function validarForm() {
  let primeiro = null;
  const marcar = (id, invalido) => {
    const el = document.getElementById(id);
    el.classList.toggle('field-error', invalido);
    if (invalido && !primeiro) primeiro = el;
    return el;
  };

  marcar('f-data', !document.getElementById('f-data').value.trim());
  marcar('f-loja', !document.getElementById('f-loja').value.trim());
  marcar('f-preenchidoPor', !document.getElementById('f-preenchidoPor').value.trim());

  const tipo = document.getElementById('f-tipoHorario').value;
  if (tipo !== 'Bloqueio') {
    marcar('f-endereco', !document.getElementById('f-endereco').value.trim());
  } else {
    document.getElementById('f-endereco').classList.remove('field-error');
  }

  if (tipo === 'Retirada' || tipo === 'Bloqueio') {
    marcar('f-horarioFim', !document.getElementById('f-horarioFim').value.trim());
  } else {
    document.getElementById('f-horarioFim').classList.remove('field-error');
  }

  return primeiro;
}

async function salvarViagem() {
  const primeiroInvalido = validarForm();
  if (primeiroInvalido) {
    document.getElementById('formValidationMsg').textContent = 'Preencha os campos obrigatórios antes de salvar (em vermelho).';
    primeiroInvalido.focus();
    return;
  }
  document.getElementById('formValidationMsg').textContent = '';

  const notas = Array.from(document.querySelectorAll('#notasContainer .nota-block')).map((b) => ({
    nome: b.querySelector('.n-nome').value.trim(),
    itens: b.querySelector('.n-itens').value
  })).filter((n) => n.nome || n.itens.trim());

  const tipoHorario = document.getElementById('f-tipoHorario').value;
  const payload = {
    data: document.getElementById('f-data').value,
    loja: document.getElementById('f-loja').value,
    tipoHorario,
    horario: document.getElementById('f-horario').value.trim(),
    horarioFim: document.getElementById('f-horarioFim').value.trim(),
    endereco: document.getElementById('f-endereco').value.trim(),
    numero: document.getElementById('f-numero').value.trim(),
    complemento: document.getElementById('f-complemento').value.trim(),
    clienteFornecedor: document.getElementById('f-clienteFornecedor').value.trim(),
    numeroPedido: document.getElementById('f-numeroPedido').value.trim(),
    itens: document.getElementById('f-itens').value,
    contatoNome: document.getElementById('f-contatoNome').value.trim(),
    contatoWhats: document.getElementById('f-contatoWhats').value.trim(),
    volumes: document.getElementById('f-volumes').value.trim(),
    info: document.getElementById('f-info').value,
    dividir: document.getElementById('f-dividir').checked,
    notas,
    preenchidoPor: document.getElementById('f-preenchidoPor').value.trim()
  };

  const btnSalvar = document.getElementById('btnSalvarViagem');
  const textoOriginal = btnSalvar.textContent;
  btnSalvar.disabled = true;
  btnSalvar.textContent = 'Salvando...';

  try {
    const salva = editandoId
      ? await AgendaStore.atualizarViagem(editandoId, payload)
      : await AgendaStore.criarViagem(payload);
    const moveuDeDia = payload.data !== diaAtual;
    fecharForm();
    if (moveuDeDia) {
      mostrarToast(`Viagem salva em ${formatDataLine(payload.data)} ✓`);
      await carregarDia();
    } else {
      mostrarToast('Viagem salva ✓');
      await carregarDia(salva.id);
    }
    refrescarCalendario();
    voltarAoTopo();
  } catch (e) {
    document.getElementById('formValidationMsg').textContent = e.message;
    mostrarToast('Não foi possível salvar: ' + e.message, 'erro');
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.textContent = textoOriginal;
  }
}

async function buscarCep() {
  const cepInput = document.getElementById('f-cep');
  const msgEl = document.getElementById('cepMsg');
  const cep = cepInput.value.replace(/\D/g, '');
  if (cep.length !== 8) {
    msgEl.textContent = 'Digite um CEP válido (8 dígitos).';
    msgEl.className = 'cep-msg err';
    return;
  }
  msgEl.textContent = 'Buscando...';
  msgEl.className = 'cep-msg';
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await resp.json();
    if (data.erro) {
      msgEl.textContent = 'CEP não encontrado.';
      msgEl.className = 'cep-msg err';
      return;
    }
    const endereco = [data.logradouro, data.bairro, `${data.localidade}/${data.uf}`].filter(Boolean).join(' - ');
    document.getElementById('f-endereco').value = endereco;
    msgEl.textContent = 'Endereço preenchido. Complete com número/complemento se precisar.';
    msgEl.className = 'cep-msg ok';
  } catch (e) {
    msgEl.textContent = 'Não foi possível buscar o CEP agora.';
    msgEl.className = 'cep-msg err';
  }
}

// --------------------------------------------------------------------------
// Texto WhatsApp / Relatório / Excel / Rota — sempre sobre o dia inteiro
// (o filtro de loja é só uma lente de visualização, não recorta as saídas)
// --------------------------------------------------------------------------
function buildTripText(v, mostrarLoja) {
  if (v.tipoHorario === 'Bloqueio') {
    let linha = `⏸ *Bloqueio: ${v.horario || '--:--'} às ${v.horarioFim || '--:--'}*`;
    if (mostrarLoja) linha += ` (${AgendaStore.LOJA_LABEL[v.loja] || v.loja})`;
    if (v.info) linha += `\n${v.info}`;
    return linha;
  }

  let enderecoCompleto = v.endereco || '';
  if (v.numero) enderecoCompleto += `, ${v.numero}`;
  if (v.complemento) enderecoCompleto += ` - ${v.complemento}`;

  const boldLines = [`${formatDataLine(v.data)}${enderecoCompleto ? ' - ' + enderecoCompleto : ''}`];
  if (v.horario || v.horarioFim) {
    boldLines.push(`${v.tipoHorario}: ${v.horario || '--:--'}${v.horarioFim ? ' às ' + v.horarioFim : ''}`);
  }
  if (mostrarLoja) boldLines.push(`Loja: ${AgendaStore.LOJA_LABEL[v.loja] || v.loja}`);
  if (v.clienteFornecedor || v.numeroPedido) boldLines.push(`Pedido/Fornecedor: ${v.numeroPedido || ''}${v.numeroPedido && v.clienteFornecedor ? ' ' : ''}${v.clienteFornecedor || ''}`);
  if (v.contatoNome || v.contatoWhats) boldLines.push(`Contato: ${v.contatoNome || ''}${v.contatoNome && v.contatoWhats ? ' - ' : ''}${v.contatoWhats || ''}`);

  const lines = ['*' + boldLines.join('\n') + '*'];
  nonEmptyLines(v.itens).forEach((i) => lines.push(i));
  if (v.volumes) lines.push(`*Volume: ${v.volumes}*`);
  const infoLines = nonEmptyLines(v.info);
  if (infoLines.length) {
    lines.push('*Informações:*');
    lines.push('');
    infoLines.forEach((i) => lines.push(`- ${i}`));
  }

  if (v.dividir && v.notas && v.notas.length) {
    const validas = v.notas.filter((n) => n.nome || nonEmptyLines(n.itens).length);
    if (validas.length) {
      lines.push('');
      lines.push(`*Este total terá ${validas.length} notas fiscais, sendo:*`);
      validas.forEach((n) => {
        lines.push('');
        lines.push(`*${n.nome || '(empresa)'}*:`);
        nonEmptyLines(n.itens).forEach((i) => lines.push(i));
      });
    }
  }

  if (v.preenchidoPor) {
    lines.push('');
    lines.push(`*Preenchido por: ${v.preenchidoPor}*`);
  }

  return lines.join('\n');
}

function gerarTextoDia() {
  if (!viagensDia.length) return '';
  const mostrarLoja = new Set(viagensDia.map((v) => v.loja)).size > 1;
  const titulo = `🚚 Agenda de Motorista - Casa Timoni - ${formatDataTitulo(diaAtual)}🚚`;
  const sep = '='.repeat(47);
  return '*' + titulo + '*\n\n' + viagensDia.map((v) => buildTripText(v, mostrarLoja)).join('\n' + sep + '\n\n');
}

function renderOutput() {
  document.getElementById('output').value = gerarTextoDia();
}

function copiarTexto() {
  const out = document.getElementById('output');
  if (!out.value.trim()) {
    document.getElementById('diaValidationMsg').textContent = 'Nenhuma viagem cadastrada para copiar.';
    return;
  }
  document.getElementById('diaValidationMsg').textContent = '';
  out.select();
  out.setSelectionRange(0, out.value.length);
  function showCopied() {
    const m = document.getElementById('copiedMsg');
    m.style.opacity = 1;
    setTimeout(() => { m.style.opacity = 0; }, 1500);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(out.value).then(showCopied).catch(() => { document.execCommand('copy'); showCopied(); });
  } else {
    document.execCommand('copy');
    showCopied();
  }
}

function printText(texto) {
  const escaped = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Imprimir</title>'
    + '<style>body{font-family:"Courier New",monospace;font-size:15px;white-space:pre-wrap;padding:20px;margin:0;}</style>'
    + '</head><body>' + escaped + '</body></html>';
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    document.getElementById('diaValidationMsg').textContent = 'Não foi possível abrir a janela de impressão. Permita pop-ups para este site e tente novamente.';
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { try { printWindow.print(); } catch (e) { /* ignore */ } }, 300);
}

function relatorioTexto() {
  const entregas = viagensDia.filter((v) => v.tipoHorario === 'Entrega');
  const retiradas = viagensDia.filter((v) => v.tipoHorario === 'Retirada');
  const bloqueios = viagensDia.filter((v) => v.tipoHorario === 'Bloqueio');
  const mostrarLoja = new Set(viagensDia.map((v) => v.loja)).size > 1;
  const sep = '-'.repeat(30);
  const secao = (titulo, lista) => {
    let t = `${titulo} (${lista.length})\n${sep}\n\n`;
    t += lista.length ? lista.map((v) => buildTripText(v, mostrarLoja)).join('\n\n' + sep + '\n\n') : '(nenhuma)';
    return t;
  };
  let txt = `RELATÓRIO DO MOTORISTA\n${formatDataTitulo(diaAtual).toUpperCase()}\n\n`;
  txt += secao('ENTREGAS', entregas) + '\n\n\n';
  txt += secao('RETIRADAS', retiradas);
  if (bloqueios.length) txt += '\n\n\n' + secao('BLOQUEIOS', bloqueios);
  return txt;
}

function imprimirRelatorio() {
  if (!viagensDia.length) {
    document.getElementById('diaValidationMsg').textContent = 'Não há viagens cadastradas neste dia.';
    return;
  }
  document.getElementById('diaValidationMsg').textContent = '';
  printText(relatorioTexto());
}

function escXml(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function gerarExcelDia() {
  if (!viagensDia.length) {
    document.getElementById('diaValidationMsg').textContent = 'Não há viagens cadastradas neste dia para gerar o relatório.';
    return;
  }
  document.getElementById('diaValidationMsg').textContent = '';

  const headers = ['Ordem', 'Loja', 'Tipo', 'De', 'Até', 'Endereço', 'Número', 'Complemento', 'Cliente/Fornecedor', 'NF/Pedido', 'Detalhamento', 'Contato', 'WhatsApp', 'Volume', 'Outras informações/Motivo', 'Anexos', 'Preenchido por'];
  const rows = viagensDia.map((v, idx) => {
    const anexosResumo = v.dividir ? (v.notas || []).map((n) => n.nome).filter(Boolean).join(' / ') || 'Sim' : '';
    return [
      idx + 1,
      AgendaStore.LOJA_LABEL[v.loja] || v.loja,
      v.tipoHorario,
      v.horario,
      v.horarioFim || '',
      v.endereco,
      v.numero,
      v.complemento,
      v.clienteFornecedor,
      v.numeroPedido,
      (v.itens || '').replace(/\n/g, '; '),
      v.contatoNome,
      v.contatoWhats,
      v.volumes,
      (v.info || '').replace(/\n/g, '; '),
      anexosResumo,
      v.preenchidoPor
    ];
  });

  let xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  xml += '<Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#DBE4F0" ss:Pattern="Solid"/></Style></Styles>\n';
  xml += '<Worksheet ss:Name="Agenda"><Table>\n';
  xml += '<Row>' + headers.map((h) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escXml(h)}</Data></Cell>`).join('') + '</Row>\n';
  rows.forEach((r) => { xml += '<Row>' + r.map((v) => `<Cell><Data ss:Type="String">${escXml(v)}</Data></Cell>`).join('') + '</Row>\n'; });
  xml += '</Table></Worksheet>\n</Workbook>';

  const dataUrl = 'data:application/vnd.ms-excel;charset=utf-8,' + encodeURIComponent(xml);
  const filename = `agenda-motorista-${diaAtual}.xls`;
  const win = window.open('', '_blank');
  if (!win) {
    document.getElementById('diaValidationMsg').textContent = 'Não foi possível abrir a janela para gerar o relatório. Permita pop-ups para este site e tente novamente.';
    return;
  }
  win.document.open();
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório</title></head><body>Gerando relatório...</body></html>');
  win.document.close();
  const a = win.document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  win.document.body.appendChild(a);
  a.click();
  setTimeout(() => { try { win.close(); } catch (e) { /* ignore */ } }, 500);
}

function abrirRota() {
  const paradas = viagensDia.filter((v) => v.tipoHorario !== 'Bloqueio' && v.endereco).map((v) => {
    let end = v.endereco;
    if (v.numero) end += `, ${v.numero}`;
    if (v.complemento) end += ` - ${v.complemento}`;
    return end;
  });
  if (!paradas.length) {
    document.getElementById('diaValidationMsg').textContent = 'Nenhum endereço cadastrado nas viagens deste dia.';
    return;
  }
  document.getElementById('diaValidationMsg').textContent = '';
  if (paradas.length === 1) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(paradas[0])}&travelmode=driving`, '_blank');
    return;
  }
  const destino = paradas[paradas.length - 1];
  const waypoints = paradas.slice(0, -1).map(encodeURIComponent).join('|');
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}&waypoints=${waypoints}&travelmode=driving`, '_blank');
}

// --------------------------------------------------------------------------
// Modo Motorista — lista simples do dia com check-in/check-out e observação.
// As marcações gravam na mesma viagem (via AgendaStore.atualizarViagem), então em modo
// planilha aparecem também pra quem organiza a agenda, quase em tempo real.
// --------------------------------------------------------------------------
async function abrirModoMotorista() {
  diaMotorista = diaMotorista || toDataStr(new Date());
  mostrarTela('telaMotorista');
  await renderModoMotorista();
}

async function renderModoMotorista() {
  document.getElementById('motoristaDataLabel').textContent = formatDataTitulo(diaMotorista);
  document.getElementById('motoristaModoLocal').hidden = await AgendaStore.isRemote();

  const lista = document.getElementById('listaMotorista');
  let viagens;
  try {
    viagens = await AgendaStore.listarDia(diaMotorista);
  } catch (e) {
    lista.innerHTML = `<p class="validation-msg">${escHtml(e.message)}</p>`;
    return;
  }

  lista.innerHTML = '';
  if (!viagens.length) {
    lista.innerHTML = '<p class="hint-text">Nenhuma viagem cadastrada para este dia.</p>';
    return;
  }

  viagens.forEach((v) => {
    const isBloqueio = v.tipoHorario === 'Bloqueio';
    const enderecoResumo = [v.endereco, v.numero].filter(Boolean).join(', ');
    const mapsUrl = enderecoResumo ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoResumo)}` : null;

    let statusHtml;
    if (isBloqueio) {
      statusHtml = '';
    } else if (v.checkoutEm) {
      statusHtml = `<span class="status-pill status-concluida">✓ Concluída às ${formatHoraCurta(v.checkoutEm)}</span>`;
    } else if (v.checkinEm) {
      statusHtml = `<span class="status-pill status-andamento">No local desde ${formatHoraCurta(v.checkinEm)}</span><button class="btn-primary btn-grande js-checkout" data-id="${v.id}">Concluí</button>`;
    } else {
      statusHtml = `<button class="btn-primary btn-grande js-checkin" data-id="${v.id}">Cheguei</button>`;
    }

    const card = document.createElement('div');
    card.className = 'motorista-card';
    card.innerHTML = `
      <div class="motorista-topo">
        <span class="viagem-horario">${escHtml(v.horario) || '--:--'}</span>
        <span class="tag ${v.tipoHorario === 'Retirada' ? 'tag-retirada' : (isBloqueio ? 'tag-bloqueio' : 'tag-entrega')}">${isBloqueio ? '🔒 Bloqueio' : escHtml(v.tipoHorario)}</span>
        <span class="tag tag-loja">${escHtml(AgendaStore.LOJA_LABEL[v.loja] || v.loja)}</span>
        ${v.horarioFim ? `<span class="tag tag-loja">até ${escHtml(v.horarioFim)}</span>` : ''}
      </div>
      ${isBloqueio
        ? `<p class="viagem-resumo">${escHtml(v.info) || '(sem motivo informado)'}</p>`
        : `<p class="viagem-resumo"><strong>${escHtml(v.clienteFornecedor) || '(sem cliente/fornecedor)'}</strong></p>
           <p class="viagem-sub">${escHtml(enderecoResumo) || 'Endereço não informado'}${mapsUrl ? ` — <a href="${mapsUrl}" target="_blank" rel="noopener">abrir no Maps</a>` : ''}</p>
           ${(v.contatoNome || v.contatoWhats) ? `<p class="viagem-sub">Contato: ${escHtml(v.contatoNome)}${v.contatoWhats ? ' - ' + escHtml(v.contatoWhats) : ''}</p>` : ''}`}
      <div class="motorista-status">${statusHtml}</div>
      ${!isBloqueio ? `
        <label>Observação</label>
        <textarea class="motorista-obs" data-id="${v.id}">${escHtml(v.observacaoMotorista || '')}</textarea>
        <button class="btn-secondary btn-small js-salvar-obs" data-id="${v.id}">Salvar observação</button>
      ` : ''}
    `;
    lista.appendChild(card);
  });

  lista.querySelectorAll('.js-checkin').forEach((btn) => btn.addEventListener('click', () => marcarCheckin(btn.dataset.id)));
  lista.querySelectorAll('.js-checkout').forEach((btn) => btn.addEventListener('click', () => marcarCheckout(btn.dataset.id)));
  lista.querySelectorAll('.js-salvar-obs').forEach((btn) => btn.addEventListener('click', () => salvarObservacaoMotorista(btn.dataset.id, btn)));
}

async function marcarCheckin(id) {
  try {
    await AgendaStore.atualizarViagem(id, { checkinEm: new Date().toISOString() });
    mostrarToast('Check-in registrado ✓');
    await renderModoMotorista();
  } catch (e) {
    mostrarToast('Não foi possível registrar: ' + e.message, 'erro');
  }
}

async function marcarCheckout(id) {
  try {
    await AgendaStore.atualizarViagem(id, { checkoutEm: new Date().toISOString() });
    mostrarToast('Check-out registrado ✓');
    await renderModoMotorista();
  } catch (e) {
    mostrarToast('Não foi possível registrar: ' + e.message, 'erro');
  }
}

async function salvarObservacaoMotorista(id, btn) {
  const textarea = document.querySelector(`.motorista-obs[data-id="${id}"]`);
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Salvando...';
  try {
    await AgendaStore.atualizarViagem(id, { observacaoMotorista: textarea.value });
    mostrarToast('Observação salva ✓');
  } catch (e) {
    mostrarToast('Não foi possível salvar: ' + e.message, 'erro');
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

// --------------------------------------------------------------------------
// Configuração (só a URL da planilha — não existe mais "loja do computador")
// --------------------------------------------------------------------------
async function abrirConfig() {
  document.getElementById('inputWebAppUrl').value = await AgendaStore.getWebAppUrl();
  document.getElementById('configStatus').textContent = '';
  document.getElementById('configStatus').className = 'conn-status';
  mostrarTela('telaConfig');
}

// --------------------------------------------------------------------------
// Wiring de eventos (roda depois que o HTML já existe, script fica no fim do body)
// --------------------------------------------------------------------------
document.getElementById('btnModoMotorista').addEventListener('click', abrirModoMotorista);
document.getElementById('btnSairMotorista').addEventListener('click', () => {
  mostrarTela('telaAgenda');
  refrescarCalendario();
  if (diaAtual) carregarDia();
});
document.getElementById('btnMotoristaHoje').addEventListener('click', () => { diaMotorista = toDataStr(new Date()); renderModoMotorista(); });
document.getElementById('btnMotoristaAnterior').addEventListener('click', () => {
  const d = dataStrParaDate(diaMotorista); d.setDate(d.getDate() - 1); diaMotorista = toDataStr(d); renderModoMotorista();
});
document.getElementById('btnMotoristaProximo').addEventListener('click', () => {
  const d = dataStrParaDate(diaMotorista); d.setDate(d.getDate() + 1); diaMotorista = toDataStr(d); renderModoMotorista();
});

document.getElementById('btnConfig').addEventListener('click', abrirConfig);
document.getElementById('btnFecharConfig').addEventListener('click', () => { mostrarTela('telaAgenda'); refrescarCalendario(); });
document.getElementById('btnSalvarConfig').addEventListener('click', async () => {
  const statusEl = document.getElementById('configStatus');
  try {
    await AgendaStore.setWebAppUrl(document.getElementById('inputWebAppUrl').value);
    statusEl.textContent = 'Testando conexão...';
    statusEl.className = 'conn-status';
    const r = await AgendaStore.testarConexao();
    if (r.ok) {
      statusEl.textContent = 'Conectado à planilha ✓';
      statusEl.className = 'conn-status ok';
    } else {
      statusEl.textContent = 'Falha ao conectar: ' + r.erro;
      statusEl.className = 'conn-status err';
    }
  } catch (e) {
    statusEl.textContent = e.message;
    statusEl.className = 'conn-status err';
  }
});

document.querySelectorAll('.js-modo-cal').forEach((btn) => {
  btn.addEventListener('click', () => {
    modoCalendario = btn.dataset.modo;
    document.querySelectorAll('.js-modo-cal').forEach((b) => b.classList.toggle('ativo', b.dataset.modo === modoCalendario));
    document.getElementById('calGridSemana').hidden = modoCalendario !== 'semana';
    document.getElementById('calGrid').hidden = modoCalendario !== 'mes';
    refrescarCalendario();
  });
});

document.getElementById('btnAnterior').addEventListener('click', () => {
  if (modoCalendario === 'semana') {
    semanaAtualInicio.setDate(semanaAtualInicio.getDate() - 7);
  } else {
    mesAtual.mes--; if (mesAtual.mes < 1) { mesAtual.mes = 12; mesAtual.ano--; }
  }
  refrescarCalendario();
});
document.getElementById('btnProximo').addEventListener('click', () => {
  if (modoCalendario === 'semana') {
    semanaAtualInicio.setDate(semanaAtualInicio.getDate() + 7);
  } else {
    mesAtual.mes++; if (mesAtual.mes > 12) { mesAtual.mes = 1; mesAtual.ano++; }
  }
  refrescarCalendario();
});
document.getElementById('btnHoje').addEventListener('click', () => {
  const hoje = new Date();
  mesAtual = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  semanaAtualInicio = segundaDaSemana(hoje);
  refrescarCalendario();
});

document.querySelectorAll('.js-filtro-loja').forEach((btn) => {
  btn.addEventListener('click', () => {
    filtroLoja = btn.dataset.loja;
    atualizarChipsFiltro();
    renderDia();
  });
});

document.getElementById('btnNovaViagem').addEventListener('click', () => abrirForm(null));
document.getElementById('btnBloquearHorario').addEventListener('click', () => {
  abrirForm(null);
  document.getElementById('f-tipoHorario').value = 'Bloqueio';
  toggleTipoCampos();
  document.getElementById('formTitulo').textContent = 'Bloquear período';
  document.getElementById('f-horario').focus();
});
document.getElementById('btnCancelarForm').addEventListener('click', fecharForm);
document.getElementById('formOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'formOverlay') fecharForm();
});
document.getElementById('btnSalvarViagem').addEventListener('click', salvarViagem);
document.getElementById('btnExcluirNoForm').addEventListener('click', () => { if (editandoId) excluirItem(editandoId); fecharForm(); });
document.getElementById('f-tipoHorario').addEventListener('change', toggleTipoCampos);
document.getElementById('f-dividir').addEventListener('change', () => toggleNotas(true));
document.getElementById('addNotaBtn').addEventListener('click', () => addNota('', ''));
document.getElementById('f-horario').addEventListener('blur', (e) => { e.target.value = formatTime(e.target.value); });
document.getElementById('f-horarioFim').addEventListener('blur', (e) => { e.target.value = formatTime(e.target.value); });
document.getElementById('f-contatoWhats').addEventListener('input', (e) => { e.target.value = formatPhone(e.target.value); });
document.getElementById('btnBuscarCep').addEventListener('click', buscarCep);

document.getElementById('btnCopiarTexto').addEventListener('click', copiarTexto);
document.getElementById('btnImprimirRelatorio').addEventListener('click', imprimirRelatorio);
document.getElementById('btnGerarExcel').addEventListener('click', gerarExcelDia);
document.getElementById('btnAbrirRota').addEventListener('click', abrirRota);

init();
