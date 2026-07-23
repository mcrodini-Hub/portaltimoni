// Fonte de dados do módulo Estoque para o Painel Timoni.
// Fala com o mesmo Web App (Apps Script) que a extensão estoque-chrome usa em "modo planilha"
// (ver estoque-chrome/apps-script/Codigo.gs) — GET ?action=listar devolve { ok, produtos, necessidades }.
// Este painel só LÊ (nunca chama as ações de escrita: criar/recebido/pedido/observacao/chegou).

(function (root) {
  // "Atrasado" não vem pronto da planilha — é calculado aqui. Regra (aproximação, ajustável):
  // item com cliente aguardando parado há mais de 4h, ou qualquer item parado há mais de 48h.
  const HORAS_ATRASO_CLIENTE = 4;
  const HORAS_ATRASO_GERAL = 48;

  function parseBool(v) {
    return v === true || String(v).trim().toLowerCase() === 'true';
  }

  function idadeEmHoras(isoOuData) {
    if (!isoOuData) return 0;
    const t = new Date(isoOuData).getTime();
    if (Number.isNaN(t)) return 0;
    return (Date.now() - t) / 36e5;
  }

  function ehAtrasado(n) {
    if (n.status === 'chegou') return false;
    const idade = idadeEmHoras(n.criadoEm);
    if (parseBool(n.clienteAguardando) && idade > HORAS_ATRASO_CLIENTE) return true;
    return idade > HORAS_ATRASO_GERAL;
  }

  const LOJA_LABEL = { rio_claro: 'Rio Claro', araras: 'Araras', '': 'Todas' };

  async function buscar(webAppUrl) {
    if (!webAppUrl) return { configured: false };

    const url = webAppUrl + (webAppUrl.includes('?') ? '&' : '?') + 'action=listar';
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

    const necessidades = dados.necessidades || [];
    const abertas = necessidades.filter((n) => n.status !== 'chegou');
    const pendentes = necessidades.filter((n) => n.status === 'pendente');
    const emAndamento = necessidades.filter((n) => n.status === 'em_compra' || n.status === 'pedido_existente');
    const clienteAguardando = abertas.filter((n) => parseBool(n.clienteAguardando));
    const atrasadas = abertas.filter(ehAtrasado);

    const porPrioridade = abertas.slice().sort((a, b) => {
      const ca = parseBool(a.clienteAguardando) ? 0 : 1;
      const cb = parseBool(b.clienteAguardando) ? 0 : 1;
      if (ca !== cb) return ca - cb;
      return idadeEmHoras(b.criadoEm) - idadeEmHoras(a.criadoEm);
    });

    return {
      configured: true,
      consulta: {
        aguardandoEstoque: pendentes.length,
        clienteAguardando: clienteAguardando.length,
        itens: porPrioridade.slice(0, 3).map((n) => ({
          descricao: n.descricao || n.codigo,
          loja: LOJA_LABEL[n.unidade] || n.unidade || '',
          clienteAguardando: parseBool(n.clienteAguardando)
        }))
      },
      central: {
        aguardando: pendentes.length,
        aCaminho: emAndamento.length,
        atrasado: atrasadas.length,
        itens: atrasadas.concat(emAndamento).slice(0, 2).map((n) => ({
          descricao: n.descricao || n.codigo,
          atrasado: ehAtrasado(n),
          numeroPedido: n.numeroPedido || '',
          previsaoEntrega: n.previsaoEntrega || ''
        }))
      }
    };
  }

  root.PainelEstoque = { buscar };
})(window);
