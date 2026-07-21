/**
 * Portal Timoni — Estoque
 * Backend (Web App) da Central de Necessidades, rodando no Apps Script da própria planilha.
 *
 * COMO PUBLICAR (uma vez):
 *   1. Abra a planilha do estoque no Google Sheets.
 *   2. Menu Extensões > Apps Script. Apague o conteúdo padrão e cole este arquivo.
 *   3. Salve. Depois: Implantar > Nova implantação.
 *        - Tipo: App da Web
 *        - Executar como: Eu (dono da planilha)
 *        - Quem tem acesso: Qualquer pessoa
 *   4. Copie a URL que termina em /exec e cole na extensão (⚙ Planilha > URL do Web App).
 *
 * ESTRUTURA ESPERADA DA PLANILHA (crie duas abas com estes cabeçalhos na linha 1):
 *   Aba "Produtos":
 *      A: codigo | B: descricao
 *   Aba "Necessidades":
 *      A: id | B: codigo | C: descricao | D: status | E: criadoEm |
 *      F: respondidoEm | G: numeroPedido | H: previsaoEntrega
 *
 * status possíveis: "pendente", "em_compra", "pedido_existente".
 */

var ABA_PRODUTOS = 'Produtos';
var ABA_NECESSIDADES = 'Necessidades';
var COLUNAS_NEC = ['id', 'codigo', 'descricao', 'status', 'criadoEm', 'respondidoEm', 'numeroPedido', 'previsaoEntrega'];

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = p.action || 'listar';
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    switch (action) {
      case 'listar':
        return json({ ok: true, produtos: lerProdutos(), necessidades: lerNecessidades() });
      case 'produtos':
        return json({ ok: true, produtos: lerProdutos() });
      case 'necessidades':
        return json({ ok: true, necessidades: lerNecessidades() });
      case 'criar':
        return json({ ok: true, necessidade: criar(p.codigo) });
      case 'recebido':
        return json({ ok: true, necessidade: responder(p.id, 'em_compra', {}) });
      case 'pedido':
        return json({ ok: true, necessidade: responder(p.id, 'pedido_existente', {
          numeroPedido: p.numeroPedido,
          previsaoEntrega: p.previsao
        }) });
      default:
        return json({ ok: false, erro: 'Ação desconhecida: ' + action });
    }
  } catch (err) {
    return json({ ok: false, erro: String((err && err.message) || err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

// Aceita POST também (mesmo roteamento), caso a extensão passe a usar no futuro.
function doPost(e) {
  return doGet(e);
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function planilha() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function aba(nome) {
  var sheet = planilha().getSheetByName(nome);
  if (!sheet) throw new Error('Aba "' + nome + '" não encontrada na planilha.');
  return sheet;
}

function lerProdutos() {
  var sheet = aba(ABA_PRODUTOS);
  var valores = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < valores.length; i++) {
    var codigo = String(valores[i][0] || '').trim();
    var descricao = String(valores[i][1] || '').trim();
    if (!codigo && !descricao) continue;
    out.push({ codigo: codigo, descricao: descricao });
  }
  return out;
}

function lerNecessidades() {
  var sheet = aba(ABA_NECESSIDADES);
  var valores = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < valores.length; i++) {
    var linha = valores[i];
    if (!String(linha[0] || '').trim()) continue; // sem id = linha vazia
    var reg = {};
    for (var c = 0; c < COLUNAS_NEC.length; c++) {
      reg[COLUNAS_NEC[c]] = linha[c] === '' || linha[c] === null ? null : linha[c];
    }
    reg.criadoEm = normalizarData(reg.criadoEm);
    reg.respondidoEm = normalizarData(reg.respondidoEm);
    out.push(reg);
  }
  return out;
}

// O Sheets pode devolver datas como objeto Date; padroniza para ISO string (ou mantém texto).
function normalizarData(valor) {
  if (valor === null || valor === '') return null;
  if (Object.prototype.toString.call(valor) === '[object Date]') return valor.toISOString();
  return String(valor);
}

function criar(codigo) {
  codigo = String(codigo || '').trim();
  if (!codigo) throw new Error('Código do produto não informado.');

  var produto = null;
  var produtos = lerProdutos();
  for (var i = 0; i < produtos.length; i++) {
    if (produtos[i].codigo === codigo) { produto = produtos[i]; break; }
  }
  if (!produto) throw new Error('Produto ' + codigo + ' não encontrado no catálogo.');

  // Evita solicitação duplicada: mesmo produto já pendente (sem resposta do estoque).
  var necessidades = lerNecessidades();
  for (var j = 0; j < necessidades.length; j++) {
    if (necessidades[j].codigo === codigo && necessidades[j].status === 'pendente') {
      return necessidades[j];
    }
  }

  var registro = {
    id: 'nec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    codigo: codigo,
    descricao: produto.descricao,
    status: 'pendente',
    criadoEm: new Date().toISOString(),
    respondidoEm: null,
    numeroPedido: null,
    previsaoEntrega: null
  };

  var sheet = aba(ABA_NECESSIDADES);
  sheet.appendRow(COLUNAS_NEC.map(function (c) { return registro[c] === null ? '' : registro[c]; }));
  return registro;
}

function responder(id, status, extra) {
  id = String(id || '').trim();
  if (!id) throw new Error('ID da necessidade não informado.');
  if (status === 'pedido_existente') {
    if (!extra.numeroPedido || !extra.previsaoEntrega) {
      throw new Error('Informe o número do pedido e a previsão de entrega.');
    }
  }

  var sheet = aba(ABA_NECESSIDADES);
  var valores = sheet.getDataRange().getValues();
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0] || '').trim() === id) {
      var linhaSheet = i + 1; // 1-based, +1 do cabeçalho já embutido no índice
      sheet.getRange(linhaSheet, coluna('status')).setValue(status);
      sheet.getRange(linhaSheet, coluna('respondidoEm')).setValue(new Date().toISOString());
      if (status === 'pedido_existente') {
        sheet.getRange(linhaSheet, coluna('numeroPedido')).setValue(extra.numeroPedido);
        sheet.getRange(linhaSheet, coluna('previsaoEntrega')).setValue(extra.previsaoEntrega);
      }
      var necessidades = lerNecessidades();
      for (var k = 0; k < necessidades.length; k++) {
        if (necessidades[k].id === id) return necessidades[k];
      }
    }
  }
  throw new Error('Necessidade ' + id + ' não encontrada.');
}

function coluna(nome) {
  return COLUNAS_NEC.indexOf(nome) + 1; // 1-based
}
