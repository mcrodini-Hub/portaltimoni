// Agenda de Motorista — Portal Timoni
// Lógica da interface: calendário, dia, formulário de viagem, relatório e rota.
// Dados via AgendaStore (lib/store.js — planilha compartilhada ou localStorage local).

let lojaAtualDevice = null;
let mesAtual = { ano: 0, mes: 0 };
let diaAtual = null;
let viagensDia = [];
let filtroLoja = 'todas';
let editandoId = null;
let notaCount = 0;
let toastTimer = null;

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
  }, 2200);
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

function minutosParaHorario(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
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
// Navegação entre telas
// --------------------------------------------------------------------------
function mostrarTela(nome) {
  ['telaLoja', 'telaConfig', 'telaCalendario', 'telaDia'].forEach((id) => {
    document.getElementById(id).hidden = id !== nome;
  });
}

function atualizarLojaPill() {
  document.getElementById('lojaPillWrap').hidden = false;
  document.getElementById('lojaPill').textContent = `CT ${AgendaStore.LOJA_LABEL[lojaAtualDevice]}`;
}

async function init() {
  const loja = await AgendaStore.getLoja();
  if (!loja) {
    mostrarTela('telaLoja');
    return;
  }
  lojaAtualDevice = loja;
  atualizarLojaPill();
  const hoje = new Date();
  mesAtual = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  mostrarTela('telaCalendario');
  renderCalendario();
}

// --------------------------------------------------------------------------
// Calendário
// --------------------------------------------------------------------------
const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

async function renderCalendario() {
  document.getElementById('calMesLabel').textContent = `${NOMES_MES[mesAtual.mes - 1]} ${mesAtual.ano}`;
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
    cel.className = 'cal-day' + (foraMes ? ' fora-mes' : '') + (dataStr === hojeStr ? ' hoje' : '');
    cel.innerHTML = `
      <span class="cal-day-num">${d.getDate()}</span>
      ${tag ? `<span class="cal-day-tag">${tag}</span>` : ''}
      ${info ? `<div class="cal-day-counts">
        ${info.entregas ? `<span class="cal-count"><span class="dot dot-entrega"></span>${info.entregas}</span>` : ''}
        ${info.retiradas ? `<span class="cal-count"><span class="dot dot-retirada"></span>${info.retiradas}</span>` : ''}
      </div>` : ''}
    `;
    cel.addEventListener('click', () => abrirDia(dataStr));
    grid.appendChild(cel);
  }
}

// --------------------------------------------------------------------------
// Dia
// --------------------------------------------------------------------------
async function abrirDia(data) {
  diaAtual = data;
  filtroLoja = 'todas';
  fecharForm();
  document.getElementById('diaValidationMsg').textContent = '';
  atualizarChipsFiltro();
  mostrarTela('telaDia');
  await carregarDia();
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

function calcularConflitos(viagens) {
  const retiradas = viagens.filter((v) => v.tipoHorario === 'Retirada' && v.horario && v.bloqueioMinutos);
  return viagens.map((v) => {
    if (v.tipoHorario === 'Retirada') return null;
    const inicioV = paraMinutos(v.horario);
    if (inicioV === null) return null;
    for (const r of retiradas) {
      const inicioR = paraMinutos(r.horario);
      if (inicioR === null) continue;
      const fimR = inicioR + Number(r.bloqueioMinutos || 0);
      if (inicioV >= inicioR && inicioV < fimR) {
        return `Conflita com a retirada das ${r.horario} (bloqueia entregas até ${minutosParaHorario(fimR)})`;
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
    const enderecoResumo = [v.endereco, v.numero].filter(Boolean).join(', ');
    const card = document.createElement('div');
    card.className = 'viagem-card';
    card.id = 'viagem-' + v.id;
    card.innerHTML = `
      <div class="viagem-linha">
        <div class="viagem-mover">
          <button class="icon-btn" data-mover="-1" data-id="${v.id}" title="Mover para cima" ${!podeReordenar || idx === 0 ? 'disabled' : ''}>▲</button>
          <button class="icon-btn" data-mover="1" data-id="${v.id}" title="Mover para baixo" ${!podeReordenar || idx === filtradas.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
        <div style="flex:1;min-width:0;">
          <div class="viagem-topo">
            <span class="viagem-horario">${escHtml(v.horario) || '--:--'}</span>
            <span class="tag ${v.tipoHorario === 'Retirada' ? 'tag-retirada' : 'tag-entrega'}">${escHtml(v.tipoHorario)}</span>
            <span class="tag tag-loja">${escHtml(AgendaStore.LOJA_LABEL[v.loja] || v.loja)}</span>
            ${v.tipoHorario === 'Retirada' && v.bloqueioMinutos ? `<span class="tag tag-retirada">bloqueia ${escHtml(v.bloqueioMinutos)}min</span>` : ''}
          </div>
          <p class="viagem-resumo"><strong>${escHtml(v.clienteFornecedor) || '(sem cliente/fornecedor)'}</strong>${v.numeroPedido ? ` — ${escHtml(v.numeroPedido)}` : ''}</p>
          <p class="viagem-sub">${escHtml(enderecoResumo) || 'Endereço não informado'}</p>
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
      cardDestacado.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => cardDestacado.classList.remove('destaque'), 1800);
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
    renderCalendario();
    mostrarToast('Viagem excluída');
  } catch (e) {
    document.getElementById('diaValidationMsg').textContent = e.message;
    mostrarToast('Não foi possível excluir: ' + e.message, 'erro');
  }
}

// --------------------------------------------------------------------------
// Formulário (criar / editar viagem)
// --------------------------------------------------------------------------
function toggleBloqueio() {
  const isRetirada = document.getElementById('f-tipoHorario').value === 'Retirada';
  document.getElementById('bloqueioWrap').style.display = isRetirada ? 'block' : 'none';
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
  document.getElementById('f-loja').value = lojaAtualDevice;
  document.getElementById('f-tipoHorario').value = 'Entrega';
  document.getElementById('f-horario').value = '';
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
  document.getElementById('f-bloqueioMinutos').value = '';
  document.getElementById('notasContainer').innerHTML = '';
  toggleNotas(false);
  toggleBloqueio();
  document.getElementById('formValidationMsg').textContent = '';
  document.querySelectorAll('#formPanel .field-error').forEach((el) => el.classList.remove('field-error'));
}

function preencherCampos(viagem) {
  document.getElementById('f-data').value = viagem.data;
  document.getElementById('f-loja').value = viagem.loja;
  document.getElementById('f-tipoHorario').value = viagem.tipoHorario;
  document.getElementById('f-horario').value = viagem.horario;
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
  document.getElementById('f-bloqueioMinutos').value = viagem.bloqueioMinutos || '';
  document.getElementById('f-dividir').checked = !!viagem.dividir;
  toggleBloqueio();
  toggleNotas(false);
  (viagem.notas || []).forEach((n) => addNota(n.nome, n.itens));
}

function abrirForm(viagem) {
  resetForm();
  editandoId = viagem ? viagem.id : null;
  document.getElementById('formTitulo').textContent = viagem ? 'Editar viagem' : 'Nova viagem';
  document.getElementById('btnExcluirNoForm').hidden = !viagem;
  if (viagem) preencherCampos(viagem);
  document.getElementById('formPanel').hidden = false;
  document.getElementById('formPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  document.getElementById('formPanel').hidden = false;
  document.getElementById('formPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  document.getElementById('formPanel').hidden = true;
  editandoId = null;
}

function validarForm() {
  const campos = ['f-data', 'f-loja', 'f-horario', 'f-endereco', 'f-numero', 'f-clienteFornecedor', 'f-numeroPedido', 'f-contatoNome', 'f-contatoWhats', 'f-volumes', 'f-preenchidoPor'];
  let primeiro = null;
  campos.forEach((id) => {
    const el = document.getElementById(id);
    const invalido = !el.value.trim();
    el.classList.toggle('field-error', invalido);
    if (invalido && !primeiro) primeiro = el;
  });
  const tipoHorario = document.getElementById('f-tipoHorario').value;
  const bloqueioEl = document.getElementById('f-bloqueioMinutos');
  if (tipoHorario === 'Retirada') {
    const invalido = !bloqueioEl.value.trim();
    bloqueioEl.classList.toggle('field-error', invalido);
    if (invalido && !primeiro) primeiro = bloqueioEl;
  } else {
    bloqueioEl.classList.remove('field-error');
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
    preenchidoPor: document.getElementById('f-preenchidoPor').value.trim(),
    bloqueioMinutos: tipoHorario === 'Retirada' ? document.getElementById('f-bloqueioMinutos').value.trim() : ''
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
    renderCalendario();
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
  let enderecoCompleto = v.endereco || '';
  if (v.numero) enderecoCompleto += `, ${v.numero}`;
  if (v.complemento) enderecoCompleto += ` - ${v.complemento}`;

  const boldLines = [`${formatDataLine(v.data)}${enderecoCompleto ? ' - ' + enderecoCompleto : ''}`];
  if (v.horario) boldLines.push(`${v.tipoHorario}: ${v.horario}`);
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
  if (v.tipoHorario === 'Retirada' && v.bloqueioMinutos) {
    lines.push(`*(bloqueia entregas por ${v.bloqueioMinutos} min a partir das ${v.horario || '--:--'})*`);
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
  const entregas = viagensDia.filter((v) => v.tipoHorario !== 'Retirada');
  const retiradas = viagensDia.filter((v) => v.tipoHorario === 'Retirada');
  const mostrarLoja = new Set(viagensDia.map((v) => v.loja)).size > 1;
  const sep = '-'.repeat(30);
  let txt = `RELATÓRIO DO MOTORISTA\n${formatDataTitulo(diaAtual).toUpperCase()}\n\n`;
  txt += `ENTREGAS (${entregas.length})\n${sep}\n\n`;
  txt += entregas.length ? entregas.map((v) => buildTripText(v, mostrarLoja)).join('\n\n' + sep + '\n\n') : '(nenhuma entrega)';
  txt += '\n\n\n';
  txt += `RETIRADAS (${retiradas.length})\n${sep}\n\n`;
  txt += retiradas.length ? retiradas.map((v) => buildTripText(v, mostrarLoja)).join('\n\n' + sep + '\n\n') : '(nenhuma retirada)';
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

  const headers = ['Ordem', 'Loja', 'Tipo', 'Horário', 'Endereço', 'Número', 'Complemento', 'Cliente/Fornecedor', 'NF/Pedido', 'Detalhamento', 'Contato', 'WhatsApp', 'Volume', 'Outras informações', 'Bloqueio (min)', 'Anexos', 'Preenchido por'];
  const rows = viagensDia.map((v, idx) => {
    const anexosResumo = v.dividir ? (v.notas || []).map((n) => n.nome).filter(Boolean).join(' / ') || 'Sim' : '';
    return [
      idx + 1,
      AgendaStore.LOJA_LABEL[v.loja] || v.loja,
      v.tipoHorario,
      v.horario,
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
      v.bloqueioMinutos || '',
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
  const paradas = viagensDia.filter((v) => v.endereco).map((v) => {
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
// Configuração (loja do computador + URL da planilha)
// --------------------------------------------------------------------------
async function abrirConfig() {
  document.getElementById('inputWebAppUrl').value = await AgendaStore.getWebAppUrl();
  document.getElementById('configLojaLabel').textContent = lojaAtualDevice ? AgendaStore.LOJA_LABEL[lojaAtualDevice] : '--';
  document.getElementById('configStatus').textContent = '';
  document.getElementById('configStatus').className = 'conn-status';
  mostrarTela('telaConfig');
}

// --------------------------------------------------------------------------
// Wiring de eventos (roda depois que o HTML já existe, script fica no fim do body)
// --------------------------------------------------------------------------
document.querySelectorAll('#telaLoja .js-loja').forEach((btn) => {
  btn.addEventListener('click', async () => {
    await AgendaStore.setLoja(btn.dataset.loja);
    lojaAtualDevice = btn.dataset.loja;
    atualizarLojaPill();
    const hoje = new Date();
    mesAtual = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
    mostrarTela('telaCalendario');
    renderCalendario();
  });
});

document.querySelectorAll('#telaConfig .js-loja').forEach((btn) => {
  btn.addEventListener('click', async () => {
    await AgendaStore.setLoja(btn.dataset.loja);
    lojaAtualDevice = btn.dataset.loja;
    atualizarLojaPill();
    document.getElementById('configLojaLabel').textContent = AgendaStore.LOJA_LABEL[lojaAtualDevice];
  });
});

document.getElementById('btnConfig').addEventListener('click', abrirConfig);
document.getElementById('btnFecharConfig').addEventListener('click', () => { mostrarTela('telaCalendario'); renderCalendario(); });
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

document.getElementById('btnMesAnterior').addEventListener('click', () => {
  mesAtual.mes--; if (mesAtual.mes < 1) { mesAtual.mes = 12; mesAtual.ano--; }
  renderCalendario();
});
document.getElementById('btnMesProximo').addEventListener('click', () => {
  mesAtual.mes++; if (mesAtual.mes > 12) { mesAtual.mes = 1; mesAtual.ano++; }
  renderCalendario();
});
document.getElementById('btnHoje').addEventListener('click', () => {
  const hoje = new Date();
  mesAtual = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  renderCalendario();
});

document.getElementById('btnVoltarCalendario').addEventListener('click', () => { mostrarTela('telaCalendario'); renderCalendario(); });
document.querySelectorAll('.js-filtro-loja').forEach((btn) => {
  btn.addEventListener('click', () => {
    filtroLoja = btn.dataset.loja;
    atualizarChipsFiltro();
    renderDia();
  });
});

document.getElementById('btnNovaViagem').addEventListener('click', () => abrirForm(null));
document.getElementById('btnCancelarForm').addEventListener('click', fecharForm);
document.getElementById('btnSalvarViagem').addEventListener('click', salvarViagem);
document.getElementById('btnExcluirNoForm').addEventListener('click', () => { if (editandoId) excluirItem(editandoId); fecharForm(); });
document.getElementById('f-tipoHorario').addEventListener('change', toggleBloqueio);
document.getElementById('f-dividir').addEventListener('change', () => toggleNotas(true));
document.getElementById('addNotaBtn').addEventListener('click', () => addNota('', ''));
document.getElementById('f-horario').addEventListener('blur', (e) => { e.target.value = formatTime(e.target.value); });
document.getElementById('f-contatoWhats').addEventListener('input', (e) => { e.target.value = formatPhone(e.target.value); });
document.getElementById('btnBuscarCep').addEventListener('click', buscarCep);

document.getElementById('btnCopiarTexto').addEventListener('click', copiarTexto);
document.getElementById('btnImprimirRelatorio').addEventListener('click', imprimirRelatorio);
document.getElementById('btnGerarExcel').addEventListener('click', gerarExcelDia);
document.getElementById('btnAbrirRota').addEventListener('click', abrirRota);

init();
