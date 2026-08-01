/**
 * Compras — Painel Timoni
 * Backend (Web App) que espelha o estado do Compras numa planilha Google.
 * A extensão continua sendo a fonte de verdade; esta planilha serve ao Portal Timoni.
 */

var ABA_ESTADO = 'Estado';
var ABA_HISTORICO = 'Historico';

var COLUNAS_ESTADO = [
  'atualizadoEm', 'currentState', 'selectedSupplierNome', 'selectedSupplierUrgente',
  'fornecedoresJson', 'itensJson', 'bessaniUrl', 'bessaniPrintAnexado',
  'conferenciaTipoDocumento', 'conferenciaAprovado', 'conferenciaChecklistJson',
  'conferenciaDivergenciasJson', 'trelloResultadosJson', 'diagnosticsJson',
  'resumoComprasJson'
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
      case 'estado':
        return json({ ok: true, estado: lerEstado() });
      case 'historico':
        return json({ ok: true, historico: lerHistorico(Number(p.limite) || 20) });
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
  }

  if (sheet.getMaxColumns() < colunas.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), colunas.length - sheet.getMaxColumns());
  }

  sheet.getRange(1, 1, 1, colunas.length).setValues([colunas]);
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
  if (sheet.getLastRow() < 2) return null;
  var linha = sheet.getRange(2, 1, 1, COLUNAS_ESTADO.length).getValues()[0];
  return registroDaLinha(COLUNAS_ESTADO, linha);
}

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
