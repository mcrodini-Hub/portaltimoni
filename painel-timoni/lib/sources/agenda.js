// Fonte de dados do módulo Agenda Ciça para o Painel Timoni.
// Fala com a rota pública do timoni-portal (Next.js) — GET /api/public/agenda-resumo?token=...
// devolve { ok, data: { total, eventos } } com os compromissos de hoje das duas agendas
// (Principal + TIMONI AGENDA). Essa rota não usa o login do portal (cookie de sessão não
// existe aqui, é outra origem) — usa um token simples compartilhado em vez disso.
// Ver timoni-portal/README.md (seção 6) para como gerar a URL e o token.

(function (root) {
  async function buscar(baseUrl, token) {
    if (!baseUrl || !token) return { configured: false };

    const url = baseUrl + '/api/public/agenda-resumo?token=' + encodeURIComponent(token);
    let resposta;
    try {
      resposta = await fetch(url, { method: 'GET' });
    } catch (e) {
      return { configured: true, error: 'Não foi possível conectar ao Timoni Portal (rede).' };
    }
    let dados;
    try {
      dados = await resposta.json();
    } catch (e) {
      return { configured: true, error: 'Resposta do Timoni Portal não é um JSON válido.' };
    }
    if (!resposta.ok || !dados || !dados.ok) {
      return { configured: true, error: (dados && dados.erro) || `Timoni Portal respondeu ${resposta.status}.` };
    }

    return {
      configured: true,
      atualizadoEm: dados.data.atualizadoEm,
      total: dados.data.total,
      eventos: dados.data.eventos
    };
  }

  root.PainelAgenda = { buscar };
})(window);
