// Fonte única de dados da Agenda do Motorista.
// A tela é somente leitura e não exige configuração no computador do motorista.

(function (root) {
  const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwy9QfpEbdGtTIiC2OFuZAUx0jIPFsXPLZKedfGp79VJ6mlzLYus_wjI2IvFPoeE6Pc/exec';

  async function chamar(params) {
    const url = `${WEBAPP_URL}?${new URLSearchParams(params).toString()}`;
    let resposta;

    try {
      resposta = await fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store' });
    } catch (erro) {
      throw new Error('Não foi possível carregar a agenda. Verifique a internet.');
    }

    if (!resposta.ok) {
      throw new Error('A agenda não respondeu corretamente.');
    }

    let dados;
    try {
      dados = await resposta.json();
    } catch (erro) {
      throw new Error('A agenda retornou uma resposta inválida.');
    }

    if (!dados || dados.ok !== true) {
      throw new Error((dados && dados.erro) || 'Não foi possível acessar a agenda.');
    }

    return dados;
  }

  function normalizarViagem(viagem) {
    let notas = [];
    try {
      notas = JSON.parse(viagem.notasJson || '[]');
    } catch (erro) {
      notas = [];
    }
    return { ...viagem, notas };
  }

  async function listarDia(data) {
    const resposta = await chamar({ action: 'dia', data });
    return (resposta.viagens || []).map(normalizarViagem);
  }

  root.AgendaStore = { listarDia };
})(self);
