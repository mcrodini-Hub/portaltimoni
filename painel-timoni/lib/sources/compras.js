// Fonte de dados do módulo Compras para o Painel Timoni.
// Fala com o Web App (Apps Script) que espelha o estado da extensão hub-pedidos-chrome numa
// planilha (ver hub-pedidos-chrome/apps-script/Codigo.gs) — GET ?action=estado devolve
// { ok, estado } com o snapshot mais recente. Este painel só LÊ (a extensão é quem escreve,
// a cada etapa, via ?action=registrar).

(function (root) {
  function parseJsonCampo(valor, fallback) {
    if (!valor) return fallback;
    try {
      return JSON.parse(valor);
    } catch (e) {
      return fallback;
    }
  }

  function parseBoolTexto(valor) {
    if (valor === 'true') return true;
    if (valor === 'false') return false;
    return null;
  }

  async function buscar(webAppUrl) {
    if (!webAppUrl) return { configured: false };

    const url = webAppUrl + (webAppUrl.includes('?') ? '&' : '?') + 'action=estado';
    let resposta;
    try {
      resposta = await fetch(url, { method: 'GET', redirect: 'follow' });
    } catch (e) {
      return { configured: true, error: 'Não foi possível conectar à planilha (rede).' };
    }
    if (!resposta.ok) {
      return { configured: true, error: `Planilha respondeu ${resposta.status}.` };
    }
    let dados;
    try {
      dados = await resposta.json();
    } catch (e) {
      return { configured: true, error: 'Resposta da planilha não é um JSON válido.' };
    }
    if (!dados || !dados.ok) {
      return { configured: true, error: (dados && dados.erro) || 'Planilha recusou o pedido.' };
    }
    if (!dados.estado) {
      return { configured: true, vazio: true };
    }

    const e = dados.estado;
    const fornecedores = parseJsonCampo(e.fornecedoresJson, []);
    const itens = parseJsonCampo(e.itensJson, []);
    const divergencias = parseJsonCampo(e.conferenciaDivergenciasJson, []);
    const resultados = parseJsonCampo(e.trelloResultadosJson, []);
    const diagnostics = parseJsonCampo(e.diagnosticsJson, {});

    const contaResultado = (status) => resultados.filter((r) => r.status === status).length;

    return {
      configured: true,
      atualizadoEm: e.atualizadoEm,
      fornecedores: {
        total: fornecedores.length,
        urgentes: fornecedores.filter((f) => f.urgente).length,
        lista: fornecedores,
        ultimaLeitura: diagnostics.lastUpdatedAt || null
      },
      itens: {
        total: itens.length,
        lista: itens,
        fornecedor: e.selectedSupplierNome || ''
      },
      conferencia: {
        aprovado: parseBoolTexto(e.conferenciaAprovado),
        tipoDocumento: e.conferenciaTipoDocumento || null,
        divergencias: divergencias
      },
      bessani: {
        url: e.bessaniUrl || '',
        printAnexado: e.bessaniPrintAnexado === 'true'
      },
      atualizacao: {
        atualizados: contaResultado('atualizado'),
        ignorados: contaResultado('ignorado'),
        naoEncontrados: contaResultado('não encontrado'),
        lista: resultados
      }
    };
  }

  root.PainelCompras = { buscar };
})(window);
