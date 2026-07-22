// Tipos de mensagem e envelope padrão trocados entre sidebar e background.
// Esqueleto inicial: apenas o necessário para o sidebar consultar/receber estado.

(function (root) {
  const TYPES = Object.freeze({
    GET_STATE: 'GET_STATE',
    STATE_UPDATED: 'STATE_UPDATED',
    TOGGLE_PIN: 'TOGGLE_PIN',
    RESET_MODULE: 'RESET_MODULE'
  });

  function makeMessage(type, payload, source) {
    return {
      type,
      payload: payload === undefined ? null : payload,
      source: source || 'unknown',
      timestamp: Date.now()
    };
  }

  root.MarketingCTMessages = { TYPES, makeMessage };
})(typeof self !== 'undefined' ? self : this);
