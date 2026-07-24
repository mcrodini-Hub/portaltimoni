/**
 * Portal Timoni — Agenda de Motorista
 * Backend (Web App) da agenda, rodando no Apps Script da própria planilha.
 *
 * COMO PUBLICAR (uma vez):
 *   1. Abra a planilha da agenda no Google Sheets.
 *   2. Menu Extensões > Apps Script. Apague o conteúdo padrão e cole este arquivo.
 *   3. Salve. Depois: Implantar > Nova implantação.
 *        - Tipo: App da Web
 *        - Executar como: Eu (dono da planilha)
 *        - Quem tem acesso: Qualquer pessoa
 *   4. Copie a URL que termina em /exec e cole na página (⚙ ao lado do título > URL do Web App).
 *
 * ESTRUTURA ESPERADA DA PLANILHA (crie uma aba com este cabeçalho na linha 1):
 *   Aba "Viagens":
 *      A: id | B: data | C: loja | D: ordem | E: tipoHorario | F: horario |
 *      G: endereco | H: numero | I: complemento | J: clienteFornecedor | K: numeroPedido |
 *      L: itens | M: contatoNome | N: contatoWhats | O: volumes | P: info |
 *      Q: dividir | R: notasJson | S: preenchidoPor | T: bloqueioMinutos |
 *      U: criadoEm | V: atualizadoEm
 *
 * data: "YYYY-MM-DD". loja: "rio_claro" ou "araras". tipoHorario: "Entrega" ou "Retirada".
 * ordem: posição da viagem dentro do dia (número, começa em 0), usada para reordenar.
 * itens / info: texto com uma linha por item (igual ao textarea da página).
 * dividir: "true"/"false". notasJson: JSON de [{nome, itens}] quando dividir = true.
 * bloqueioMinutos: só relevante quando tipoHorario = "Retirada".
 *
 * Dica opcional: o Sheets converte sozinho o que parece data/hora (colunas B e F) em valores
 * de Data/Hora de verdade — o código já lê isso de volta corretamente, mas se quiser que a
 * planilha mostre "2026-07-24" e "09:00" em vez de datas formatadas, selecione as colunas B e F
 * e troque o formato para "Texto simples" (Formatar > Número > Texto simples).
 */

var ABA_VIAGENS = 'Viagens';
var COLUNAS = ['id', 'data', 'loja', 'ordem', 'tipoHorario', 'horario', 'endereco', 'numero', 'complemento', 'clienteFornecedor', 'numeroPedido', 'itens', 'contatoNome', 'contatoWhats', 'volumes', 'info', 'dividir', 'notasJson', 'preenchidoPor', 'bloqueioMinutos', 'criadoEm', 'atualizadoEm'];

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = p.action || 'mes';
  try {
    switch (action) {
      // Leituras não travam (mesmo raciocínio do módulo Estoque).
      case 'mes':
        return json({ ok: true, resumo: resumoMes(p.ano, p.mes) });
      case 'dia':
        return json({ ok: true, viagens: lerDia(p.data) });
      // Escritas travam (comLock) para não haver duas gravando ao mesmo tempo.
      case 'criar':
        return comLock(function () { return json({ ok: true, viagem: criar(p) }); });
      case 'atualizar':
        return comLock(function () { return json({ ok: true, viagem: atualizar(p.id, p) }); });
      case 'excluir':
        return comLock(function () { excluir(p.id); return json({ ok: true }); });
      case 'reordenar':
        return comLock(function () { reordenar(p.data, JSON.parse(p.ordemJson || '[]')); return json({ ok: true }); });
      default:
        return json({ ok: false, erro: 'Ação desconhecida: ' + action });
    }
  } catch (err) {
    return json({ ok: false, erro: String((err && err.message) || err) });
  }
}

// Aceita POST também (criar/atualizar/reordenar usam POST para não esbarrar em limite de
// tamanho de URL com o texto de itens/notas). GAS preenche e.parameter também no POST
// application/x-www-form-urlencoded, então o mesmo roteamento serve para os dois.
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

function aba() {
  var sheet = planilha().getSheetByName(ABA_VIAGENS);
  if (!sheet) throw new Error('Aba "' + ABA_VIAGENS + '" não encontrada na planilha.');
  return sheet;
}

function coluna(nome) {
  return COLUNAS.indexOf(nome) + 1; // 1-based
}

function parseBool(v) {
  if (v === true) return true;
  var s = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'sim' || s === 'verdadeiro';
}

function normalizarData(valor) {
  if (valor === null || valor === '') return null;
  if (Object.prototype.toString.call(valor) === '[object Date]') return valor.toISOString();
  return String(valor);
}

// O Sheets "adivinha" o tipo da célula pelo que foi escrito: uma string "2026-07-24" vira uma
// Data de verdade, "9:00" vira uma Hora de verdade. Sem reconverter isso ao ler, reg.data e
// reg.horario voltam com Object Date em vez do texto original — e como lerDia/resumoMes
// comparam reg.data com a string "YYYY-MM-DD" pedida, a comparação falha e a viagem "some"
// mesmo estando salva na planilha. As duas funções abaixo desfazem esse "adivinhado".
function formatarDataChave(valor) {
  if (valor === null || valor === '') return '';
  if (Object.prototype.toString.call(valor) === '[object Date]') {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(valor).trim();
}

function formatarHorario(valor) {
  if (valor === null || valor === '') return '';
  if (Object.prototype.toString.call(valor) === '[object Date]') {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), 'HH:mm');
  }
  return String(valor).trim();
}

function registroDaLinha(linha) {
  var reg = {};
  for (var c = 0; c < COLUNAS.length; c++) {
    reg[COLUNAS[c]] = linha[c] === '' || linha[c] === null || linha[c] === undefined ? null : linha[c];
  }
  reg.data = formatarDataChave(reg.data);
  reg.horario = formatarHorario(reg.horario);
  reg.ordem = Number(reg.ordem || 0);
  reg.dividir = parseBool(reg.dividir);
  reg.notasJson = reg.notasJson || '[]';
  reg.criadoEm = normalizarData(reg.criadoEm);
  reg.atualizadoEm = normalizarData(reg.atualizadoEm);
  return reg;
}

function lerTudo() {
  var sheet = aba();
  var valores = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < valores.length; i++) {
    if (!String(valores[i][0] || '').trim()) continue; // sem id = linha vazia
    out.push({ linhaSheet: i + 1, reg: registroDaLinha(valores[i]) });
  }
  return out;
}

function resumoMes(ano, mes) {
  ano = String(ano || '').trim();
  mes = String(mes || '').trim().padStart(2, '0');
  var prefixo = ano + '-' + mes;
  var resumo = {};
  lerTudo().forEach(function (item) {
    if (item.reg.data.indexOf(prefixo) !== 0) return;
    if (!resumo[item.reg.data]) resumo[item.reg.data] = { entregas: 0, retiradas: 0 };
    if (item.reg.tipoHorario === 'Retirada') resumo[item.reg.data].retiradas++;
    else resumo[item.reg.data].entregas++;
  });
  return resumo;
}

function lerDia(data) {
  data = String(data || '').trim();
  var viagens = lerTudo()
    .map(function (item) { return item.reg; })
    .filter(function (reg) { return reg.data === data; });
  viagens.sort(function (a, b) { return a.ordem - b.ordem; });
  return viagens;
}

function criar(p) {
  var data = String(p.data || '').trim();
  if (!data) throw new Error('Data da viagem não informada.');
  var sheet = aba();
  var diaAtual = lerDia(data);
  var registro = {
    id: 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    data: data,
    loja: String(p.loja || '').trim(),
    ordem: diaAtual.length,
    tipoHorario: String(p.tipoHorario || 'Entrega').trim(),
    horario: String(p.horario || '').trim(),
    endereco: String(p.endereco || '').trim(),
    numero: String(p.numero || '').trim(),
    complemento: String(p.complemento || '').trim(),
    clienteFornecedor: String(p.clienteFornecedor || '').trim(),
    numeroPedido: String(p.numeroPedido || '').trim(),
    itens: String(p.itens || ''),
    contatoNome: String(p.contatoNome || '').trim(),
    contatoWhats: String(p.contatoWhats || '').trim(),
    volumes: String(p.volumes || '').trim(),
    info: String(p.info || ''),
    dividir: parseBool(p.dividir),
    notasJson: String(p.notasJson || '[]'),
    preenchidoPor: String(p.preenchidoPor || '').trim(),
    bloqueioMinutos: String(p.bloqueioMinutos || '').trim(),
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };
  sheet.appendRow(COLUNAS.map(function (c) { return registro[c] === null ? '' : registro[c]; }));
  return registro;
}

function localizarLinha(id) {
  id = String(id || '').trim();
  if (!id) throw new Error('ID da viagem não informado.');
  var achado = lerTudo().find(function (item) { return item.reg.id === id; });
  if (!achado) throw new Error('Viagem ' + id + ' não encontrada.');
  return achado;
}

var CAMPOS_EDITAVEIS = ['data', 'loja', 'tipoHorario', 'horario', 'endereco', 'numero', 'complemento', 'clienteFornecedor', 'numeroPedido', 'itens', 'contatoNome', 'contatoWhats', 'volumes', 'info', 'dividir', 'notasJson', 'preenchidoPor', 'bloqueioMinutos'];

function atualizar(id, p) {
  var achado = localizarLinha(id);
  var sheet = aba();
  CAMPOS_EDITAVEIS.forEach(function (campo) {
    if (!(campo in p)) return;
    var valor = campo === 'dividir' ? parseBool(p[campo]) : String(p[campo] || '');
    sheet.getRange(achado.linhaSheet, coluna(campo)).setValue(valor);
  });
  sheet.getRange(achado.linhaSheet, coluna('atualizadoEm')).setValue(new Date().toISOString());
  return registroDaLinha(sheet.getRange(achado.linhaSheet, 1, 1, COLUNAS.length).getValues()[0]);
}

function excluir(id) {
  var achado = localizarLinha(id);
  aba().deleteRow(achado.linhaSheet);
}

function reordenar(data, ordemIds) {
  data = String(data || '').trim();
  if (!data) throw new Error('Data não informada.');
  var sheet = aba();
  var itens = lerTudo().filter(function (item) { return item.reg.data === data; });
  ordemIds.forEach(function (id, index) {
    var item = itens.find(function (it) { return it.reg.id === id; });
    if (item) sheet.getRange(item.linhaSheet, coluna('ordem')).setValue(index);
  });
}
