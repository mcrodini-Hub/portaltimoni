// Leitura objetiva dos totais do quadro Compras para espelhar no Portal Timoni.
(function () {
  if (self.__portalTimoniComprasResumoLoaded) return;
  self.__portalTimoniComprasResumoLoaded = true;

  const BOARD_SHORT_LINK = 'UfPrTr1H';

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function listMatches(list, tokens) {
    const name = normalize(list?.name);
    return !list?.closed && tokens.every((token) => name.includes(token));
  }

  function cardHasLabel(card, labelName) {
    const target = normalize(labelName);
    return (card?.labels || []).some((label) => normalize(label?.name) === target);
  }

  async function fetchBoardJson() {
    const urls = [
      `${location.origin}/b/${BOARD_SHORT_LINK}/compras.json`,
      `${location.origin}/b/${BOARD_SHORT_LINK}.json`
    ];

    let lastError = null;
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.lists) || !Array.isArray(data.cards)) {
          throw new Error('Resposta do Trello sem listas ou cartões.');
        }
        return data;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Não foi possível ler o quadro Compras.');
  }

  function countOpenCards(data, list) {
    if (!list) return 0;
    return data.cards.filter((card) => !card.closed && card.idList === list.id).length;
  }

  async function scanResumo() {
    const data = await fetchBoardJson();

    const pendentes = data.lists.find((list) => listMatches(list, ['pedidos', 'pendentes']));
    const enviadosRioClaro = data.lists.find((list) =>
      listMatches(list, ['pedidos', 'enviado', 'rio', 'claro'])
    );
    const enviadosAraras = data.lists.find((list) =>
      listMatches(list, ['pedidos', 'enviado', 'araras'])
    );

    if (!pendentes) {
      throw new Error('Lista PEDIDOS PENDENTES não encontrada.');
    }

    const pendingCards = data.cards.filter(
      (card) => !card.closed && card.idList === pendentes.id
    );

    return {
      paraFazer: pendingCards.length,
      urgentes: pendingCards.filter((card) => cardHasLabel(card, 'Urgente')).length,
      enviadosRioClaro: countOpenCards(data, enviadosRioClaro),
      enviadosAraras: countOpenCards(data, enviadosAraras),
      atualizadoEm: new Date().toISOString(),
      listasEncontradas: {
        pendentes: !!pendentes,
        enviadosRioClaro: !!enviadosRioClaro,
        enviadosAraras: !!enviadosAraras
      }
    };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request?.type !== 'SCAN_TRELLO_RESUMO') return false;

    scanResumo()
      .then((resumo) => sendResponse({ resumo }))
      .catch((error) => sendResponse({ error: error?.message || String(error) }));

    return true;
  });
})();
