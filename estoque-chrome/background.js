// Service worker — além de abrir o side panel, verifica periodicamente a fila de
// necessidades e dispara notificações do Chrome quando algo muda (novo pedido do balcão ou
// resposta do Lucas). Serve principalmente ao perfil de acompanhamento, que precisa saber da
// troca mesmo com o painel fechado.
//
// Reaproveita a mesma camada de dados da sidebar (EstoqueStore), então funciona tanto no modo
// planilha (fetch ao Web App) quanto no modo local.

importScripts('lib/mock-produtos.js', 'lib/store.js');

const POLL_ALARM = 'estoque-poll';
const SNAP_KEY = 'estoqueSnapshot';        // último estado conhecido (id -> {status,...})
const NOTIF_KEY = 'estoqueNotificacoes';   // notificações ligadas neste computador?

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) verificarNovidades();
});

// A sidebar avisa quando as notificações são ligadas, para o snapshot começar do estado atual
// (sem disparar um monte de avisos retroativos dos itens que já existiam).
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'ESTOQUE_SNAPSHOT_RESET') {
    resetSnapshot().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

function getLocal(key, fallback) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (res) => resolve(res && key in res ? res[key] : fallback));
  });
}

function setLocal(key, value) {
  return new Promise((resolve) => chrome.storage.local.set({ [key]: value }, () => resolve()));
}

function snapshotDaLista(lista) {
  const map = {};
  lista.forEach((n) => { map[n.id] = { status: n.status }; });
  return map;
}

async function resetSnapshot() {
  try {
    const lista = await EstoqueStore.getNecessidades();
    await setLocal(SNAP_KEY, snapshotDaLista(lista));
  } catch (e) {
    // Sem conexão agora; o próximo ciclo tenta de novo.
  }
}

async function verificarNovidades() {
  const ativo = await getLocal(NOTIF_KEY, false);
  if (!ativo) return;

  let lista;
  try {
    lista = await EstoqueStore.getNecessidades();
  } catch (e) {
    return; // sem conexão; tenta no próximo ciclo
  }

  const anterior = await getLocal(SNAP_KEY, null);
  const atual = snapshotDaLista(lista);

  // Primeira verificação após ligar: só grava a linha de base, sem avisar retroativamente.
  if (!anterior) {
    await setLocal(SNAP_KEY, atual);
    return;
  }

  lista.forEach((n) => {
    const prev = anterior[n.id];
    if (!prev) {
      notificar(
        n.clienteAguardando ? 'Novo pedido do balcão · cliente aguardando' : 'Novo pedido do balcão',
        `${n.codigo} — ${n.descricao}`
      );
    } else if (prev.status !== n.status) {
      notificar(tituloMudanca(n), textoMudanca(n));
    }
  });

  await setLocal(SNAP_KEY, atual);
}

function tituloMudanca(n) {
  if (n.status === 'em_compra') return 'Estoque anotou — aguardando retorno';
  if (n.status === 'pedido_existente') return 'Estoque: já tem pedido';
  if (n.status === 'observacao') return 'Estoque respondeu';
  return 'Necessidade atualizada';
}

function textoMudanca(n) {
  if (n.status === 'pedido_existente') {
    return `${n.codigo} ${n.descricao} — pedido nº ${n.numeroPedido}, previsão ${formatarData(n.previsaoEntrega)}`;
  }
  if (n.status === 'observacao') {
    return `${n.codigo} ${n.descricao} — ${n.observacao}`;
  }
  return `${n.codigo} — ${n.descricao}`;
}

function formatarData(valor) {
  if (!valor) return '--';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(valor);
}

function notificar(titulo, mensagem) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: titulo,
    message: mensagem,
    priority: 2
  });
}
