// Configuração por região/etiqueta do board de Compras. Cada região tem sua própria
// etiqueta de filtro no Trello e suas próprias regras de listagem — ver
// prompts-referencia/1-fornecedores-pedido-enviar.txt (Rio Claro, reordena Urgente
// primeiro) e prompts-referencia/4-pedido-araras-enviar.txt (Araras, NÃO reordena, só lê
// os cartões na ordem em que o filtro nativo os mostra).
//
// `listaEnviados` (Etapa 6) só está confirmada para Rio Claro
// (prompts-referencia/3-trello-atualizar.txt: "PEDIDOS ENVIADO RIO CLARO"). Para Araras não
// existe prompt de referência equivalente para a etapa de atualização — o nome abaixo é uma
// suposição por analogia com o padrão de Rio Claro, não uma confirmação; se o nome real da
// lista for diferente, ajustar aqui.

(function (root) {
  const REGIOES = Object.freeze({
    'rio-claro': {
      id: 'rio-claro',
      nome: 'Rio Claro',
      labelFiltro: 'Rio Claro',
      corHint: 'green',
      ordenarUrgentePrimeiro: true,
      listaEnviados: 'PEDIDOS ENVIADO RIO CLARO'
    },
    araras: {
      id: 'araras',
      nome: 'Araras',
      labelFiltro: 'Araras',
      corHint: 'blue',
      ordenarUrgentePrimeiro: false,
      // Suposição por analogia (ver comentário acima) — não confirmada em prompt de referência.
      listaEnviados: 'PEDIDOS ENVIADO ARARAS'
    }
  });

  const DEFAULT_REGIAO_ID = 'rio-claro';

  function getRegiao(id) {
    return REGIOES[id] || REGIOES[DEFAULT_REGIAO_ID];
  }

  root.HubRegioes = { REGIOES, DEFAULT_REGIAO_ID, getRegiao };
})(typeof self !== 'undefined' ? self : this);
