// Agenda do Motorista — visualização simples e somente leitura.

const DIAS_VISIVEIS = 7;
const agendaEl = document.getElementById('agenda');
const statusEl = document.getElementById('status');
const atualizadoEl = document.getElementById('atualizadoEm');

function esc(valor) {
  return String(valor == null ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function dataISO(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function adicionarDias(data, quantidade) {
  const nova = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  nova.setDate(nova.getDate() + quantidade);
  return nova;
}

function capitalizar(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '';
}

function tituloDia(data) {
  return capitalizar(new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(data));
}

function dataCurta(data) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(data);
}

function minutos(horario) {
  const partes = String(horario || '').match(/(\d{1,2}):(\d{2})/);
  if (!partes) return 9999;
  return Number(partes[1]) * 60 + Number(partes[2]);
}

function ordenarViagens(viagens) {
  return [...viagens].sort((a, b) => {
    const porHorario = minutos(a.horario) - minutos(b.horario);
    if (porHorario !== 0) return porHorario;
    return Number(a.ordem || 0) - Number(b.ordem || 0);
  });
}

function montarEndereco(viagem) {
  return [viagem.endereco, viagem.numero, viagem.complemento].filter(Boolean).join(', ');
}

function linkRota(viagem) {
  const endereco = String(viagem.endereco || '').trim();
  if (!endereco) return '';
  if (/^https?:\/\//i.test(endereco)) return endereco;
  const destino = montarEndereco(viagem);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destino)}`;
}

function linha(label, valor, classeExtra = '') {
  if (!valor) return '';
  return `<p class="trip-line ${classeExtra}"><strong>${esc(label)}:</strong> ${esc(valor)}</p>`;
}

function renderViagem(viagem) {
  const rota = linkRota(viagem);
  const tipo = viagem.tipoHorario === 'Retirada' ? 'Retirada' : 'Entrega';
  const cliente = viagem.clienteFornecedor || 'Agendamento';
  const pedido = viagem.numeroPedido ? ` · ${esc(viagem.numeroPedido)}` : '';

  return `
    <article class="trip">
      <div>
        <div class="trip-time">${esc(viagem.horario || '--:--')}</div>
        <span class="trip-type ${tipo === 'Retirada' ? 'retirada' : ''}">${tipo}</span>
      </div>
      <div>
        <p class="trip-client">${esc(cliente)}<span class="trip-order">${pedido}</span></p>
        ${linha('Endereço', montarEndereco(viagem))}
        ${linha('Volumes', viagem.volumes)}
        ${linha('Itens', viagem.itens, 'trip-items')}
        ${linha('Observação', viagem.info)}
        ${rota ? `<a class="route-link" href="${esc(rota)}" target="_blank" rel="noopener noreferrer">Abrir rota</a>` : ''}
      </div>
    </article>`;
}

function renderDia(data, viagens, indice) {
  const hoje = indice === 0;
  const ordenadas = ordenarViagens(viagens);

  return `
    <section class="day-card ${hoje ? 'hoje' : ''}">
      <header class="day-header">
        <div>
          <h2 class="day-title">${tituloDia(data)}</h2>
          <span class="day-date">${dataCurta(data)}</span>
        </div>
        ${hoje ? '<span class="today-badge">HOJE</span>' : ''}
      </header>
      <div class="day-body">
        ${ordenadas.length ? ordenadas.map(renderViagem).join('') : '<p class="empty">Nenhum agendamento.</p>'}
      </div>
    </section>`;
}

async function carregarAgenda() {
  statusEl.hidden = false;
  statusEl.className = 'status';
  statusEl.textContent = 'Carregando agenda...';

  const hoje = new Date();
  const dias = Array.from({ length: DIAS_VISIVEIS }, (_, indice) => adicionarDias(hoje, indice));

  try {
    const listas = await Promise.all(dias.map((dia) => AgendaStore.listarDia(dataISO(dia))));
    agendaEl.innerHTML = dias.map((dia, indice) => renderDia(dia, listas[indice] || [], indice)).join('');
    statusEl.hidden = true;
    atualizadoEl.textContent = `Atualizado às ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
  } catch (erro) {
    agendaEl.innerHTML = '';
    statusEl.hidden = false;
    statusEl.className = 'status erro';
    statusEl.textContent = erro && erro.message ? erro.message : 'Não foi possível carregar a agenda.';
    atualizadoEl.textContent = '';
  }
}

carregarAgenda();
setInterval(carregarAgenda, 5 * 60 * 1000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) carregarAgenda();
});
