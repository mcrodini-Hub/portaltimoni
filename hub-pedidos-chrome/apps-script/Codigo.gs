/**
 * Compras — Painel Timoni
 * Backend (Web App) que espelha o estado do Compras (extensão hub-pedidos-chrome) numa
 * planilha, para o Painel Timoni conseguir mostrar os 5 cartões de Compras com dados reais.
 * Mesmo padrão gratuito já usado pelos módulos Estoque e Motorista: Google Sheets + Apps
 * Script publicado como Web App, sem servidor próprio.
 *
 * IMPORTANTE: o Compras (extensão) continua sendo a fonte de verdade — o storage local da
 * extensão (chrome.storage.local) não muda. Esta planilha é só um espelho, alimentado pela
 * própria extensão a cada etapa, para leitura externa (painel e, de brinde, um histórico
 * permanente que a extensão sozinha não guarda, já que "Reiniciar fluxo" apaga o estado local).
 *
 * COMO PUBLICAR (uma vez):
 *   1. Crie uma planilha Google nova (ex.: "Compras — Painel Timoni").
 *   2. Menu Extensões > Apps Script. Apague o conteúdo padrão e cole este arquivo.
 *   3. Salve. Depois: Implantar > Nova implantação.
 *        - Tipo: App da Web
 *        - Executar como: Eu (dono da planilha)
 *        - Quem tem acesso: Qualquer pessoa
 *   4. Copie a URL terminada em /exec e cole na extensão (seção "Painel Timoni" no rodapé da
 *      sidebar) e no Painel Timoni (⚙ Planilhas > Compras).
 *
 * As abas "Estado" e "Historico" são criadas sozinhas (com cabeçalho) no primeiro registro,
 * não precisa criar nada manualmente antes de publicar.
 */

var ABA_ESTADO = 'Estado';
var ABA_HISTORICO = 'Historico';

var COLUNAS_ESTADO = [
  'atualizadoEm', 'currentState', 'selectedSupplierNome', 'selectedSupplierUrgente',
  'fornecedoresJson', 'itensJson', 'bessaniUrl', 'bessaniPrintAnexado',
  'conferenciaTipoDocumento', 'conferenciaAprovado', 'conferenciaChecklistJson',
  'conferenciaDivergenciasJson', 'trelloResultadosJson', 'diagnosticsJson'
];

var COLUNAS_HISTORICO = [
  'finalizadoEm', 'fornecedor', 'itensCount', 'conferenciaAprovado', 'divergenciasCount',
  'trelloAtualizados', 'trelloIgnorados', 'trelloNaoEncontrados'
];

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = p.action || 'estado';
  try {
    switch (action) {
      // Leituras não travam (mesmo raciocínio dos módulos Estoque e Motorista).
      case 'estado':
        return json({ ok: true, estado: lerEstado() });
      case 'historico':
        return json({ ok: true, historico: lerHistorico(Number(p.limite) || 20) });
      // Escritas travam (comLock) para não haver duas gravando ao mesmo tempo.
      case 'registrar':
        return comLock(function () { gravarEstado(p); return json({ ok: true }); });
      case 'finalizar':
        return comLock(function () { adicionarHistorico(p); return json({ ok: true }); });
      default:
        return json({ ok: false, erro: 'Ação desconhecida: ' + action });
    }
  } catch (err) {
    return json({ ok: false, erro: String((err && err.message) || err) });
  }
}

// Aceita POST também (registrar/finalizar usam POST para não esbarrar em limite de tamanho
// de URL — os campos JSON de itens/fornecedores/divergências podem ficar longos). GAS
// preenche e.parameter também no POST application/x-www-form-urlencoded, então o mesmo
// roteamento serve para os dois.
function doPost(e) {
  return doGet(e);
}

function comLock(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    return fn();
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function planilha() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function abaOuCriar(nome, colunas) {
  var sheet = planilha().getSheetByName(nome);
  if (!sheet) {
    sheet = planilha().insertSheet(nome);
    sheet.appendRow(colunas);
  }
  return sheet;
}

function registroDaLinha(colunas, linha) {
  var reg = {};
  for (var c = 0; c < colunas.length; c++) {
    reg[colunas[c]] = linha[c] === '' || linha[c] === null || linha[c] === undefined ? null : linha[c];
  }
  return reg;
}

function lerEstado() {
  var sheet = abaOuCriar(ABA_ESTADO, COLUNAS_ESTADO);
  if (sheet.getLastRow() < 2) return null; // ainda não há nenhum registro
  var linha = sheet.getRange(2, 1, 1, COLUNAS_ESTADO.length).getValues()[0];
  return registroDaLinha(COLUNAS_ESTADO, linha);
}

// A aba Estado guarda sempre UM snapshot (linha 2) — cada "registrar" sobrescreve, não
// acumula. O histórico permanente fica na aba Historico (ver adicionarHistorico).
function gravarEstado(p) {
  var sheet = abaOuCriar(ABA_ESTADO, COLUNAS_ESTADO);
  var registro = { atualizadoEm: new Date().toISOString() };
  COLUNAS_ESTADO.forEach(function (campo) {
    if (campo === 'atualizadoEm') return;
    registro[campo] = p[campo] !== undefined ? String(p[campo]) : '';
  });
  var linha = COLUNAS_ESTADO.map(function (c) { return registro[c]; });
  if (sheet.getLastRow() < 2) {
    sheet.appendRow(linha);
  } else {
    sheet.getRange(2, 1, 1, COLUNAS_ESTADO.length).setValues([linha]);
  }
}

function lerHistorico(limite) {
  var sheet = abaOuCriar(ABA_HISTORICO, COLUNAS_HISTORICO);
  var ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 2) return [];
  var inicio = Math.max(2, ultimaLinha - limite + 1);
  var valores = sheet.getRange(inicio, 1, ultimaLinha - inicio + 1, COLUNAS_HISTORICO.length).getValues();
  return valores.map(function (linha) { return registroDaLinha(COLUNAS_HISTORICO, linha); }).reverse();
}

function adicionarHistorico(p) {
  var sheet = abaOuCriar(ABA_HISTORICO, COLUNAS_HISTORICO);
  var registro = { finalizadoEm: new Date().toISOString() };
  COLUNAS_HISTORICO.forEach(function (campo) {
    if (campo === 'finalizadoEm') return;
    registro[campo] = p[campo] !== undefined ? String(p[campo]) : '';
  });
  sheet.appendRow(COLUNAS_HISTORICO.map(function (c) { return registro[c]; }));
}
