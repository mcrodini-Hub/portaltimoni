// Fonte de dados do módulo Motorista para o Painel Timoni.
// Fala com o mesmo Web App (Apps Script) que a página agenda-motorista usa em "modo planilha"
// (ver agenda-motorista/apps-script/Codigo.gs) — GET ?action=dia&data=YYYY-MM-DD devolve
// { ok, viagens }. Este painel só LÊ (nunca cria/atualiza/exclui viagens).

(function (root) {
  const LOJA_LABEL = { rio_claro: 'Rio Claro', araras: 'Araras' };

  function hojeISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function paraMinutos(horario) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(horario || '').trim());
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  // Uma Retirada com bloqueioMinutos "segura" a saída: qualquer Entrega cujo horário caia
  // dentro da janela [retirada, retirada + bloqueioMinutos) entra em conflito — mesma regra
  // descrita no README do módulo Motorista.
  function detectarConflitos(viagens) {
    const retiradas = viagens.filter((v) => v.tipoHorario === 'Retirada' && Number(v.bloqueioMinutos) > 0);
    const entregas = viagens.filter((v) => v.tipoHorario !== 'Retirada');
    const conflitos = [];

    retiradas.forEach((retirada) => {
      const inicio = paraMinutos(retirada.horario);
      if (inicio === null) return;
      const fim = inicio + Number(retirada.bloqueioMinutos);
      entregas.forEach((entrega) => {
        const t = paraMinutos(entrega.horario);
        if (t === null) return;
        if (t >= inicio && t < fim) {
          conflitos.push({ retirada, entrega });
        }
      });
    });

    return conflitos;
  }

  async function buscar(webAppUrl, data) {
    if (!webAppUrl) return { configured: false };
    const diaAlvo = data || hojeISO();

    const url = webAppUrl + (webAppUrl.includes('?') ? '&' : '?') + `action=dia&data=${encodeURIComponent(diaAlvo)}`;
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

    const viagens = dados.viagens || [];
    const entregas = viagens.filter((v) => v.tipoHorario !== 'Retirada');
    const retiradas = viagens.filter((v) => v.tipoHorario === 'Retirada');
    const conflitos = detectarConflitos(viagens);

    return {
      configured: true,
      data: diaAlvo,
      entregas: entregas.length,
      retiradas: retiradas.length,
      conflitos: conflitos.length,
      primeiroConflito: conflitos[0]
        ? {
            texto: `Retirada ${conflitos[0].retirada.horario} (${LOJA_LABEL[conflitos[0].retirada.loja] || conflitos[0].retirada.loja}) segura a saída por ${conflitos[0].retirada.bloqueioMinutos} min — conflita com a entrega ${conflitos[0].entrega.horario} (${LOJA_LABEL[conflitos[0].entrega.loja] || conflitos[0].entrega.loja}).`
          }
        : null
    };
  }

  root.PainelMotorista = { buscar };
})(window);
