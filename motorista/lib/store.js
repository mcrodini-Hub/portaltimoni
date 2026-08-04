// Fonte única de dados da Agenda do Motorista.
// A leitura passa pelo próprio Portal para evitar bloqueios e travamentos do navegador.

(function (root) {
  const API_URL = '/api/motorista-agenda';
  const REQUEST_TIMEOUT_MS = 20_000;

  function normalizarViagem(viagem) {
    let notas = [];
    try {
      notas = JSON.parse(viagem.notasJson || '[]');
    } catch (erro) {
      notas = [];
    }
    return { ...viagem, notas };
  }

  async function chamar(params) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const url = `${API_URL}?${new URLSearchParams(params).toString()}`;

    try {
      const resposta = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal
      });

      let dados;
      try {
        dados = await resposta.json();
      } catch (erro) {
        throw new Error('A agenda retornou uma resposta inválida.');
      }

      if (!resposta.ok || !dados || dados.ok !== true) {
        throw new Error((dados && (dados.error || dados.erro)) || 'Não foi possível acessar a agenda.');
      }

      return dados;
    } catch (erro) {
      if (erro && erro.name === 'AbortError') {
        throw new Error('A agenda demorou demais para responder. Atualize a página.');
      }
      throw erro;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function listarPeriodo(inicio, dias) {
    const resposta = await chamar({ inicio, dias: String(dias || 7) });
    return (resposta.dias || []).map((dia) => ({
      ...dia,
      viagens: (dia.viagens || []).map(normalizarViagem)
    }));
  }

  async function listarDia(data) {
    const periodo = await listarPeriodo(data, 1);
    const dia = periodo[0];
    if (dia && dia.erro) throw new Error(dia.erro);
    return dia ? dia.viagens : [];
  }

  root.AgendaStore = { listarPeriodo, listarDia };
})(self);
