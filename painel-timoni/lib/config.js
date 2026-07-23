// Configuração do Painel Timoni: URLs dos Web Apps (Apps Script) dos módulos que já expõem
// dados via planilha. Guardado em localStorage — o painel é uma página estática, sem login,
// pensada para uso pessoal (mesmo padrão de "modo planilha" do Estoque e do Motorista).

(function (root) {
  const KEYS = Object.freeze({
    ESTOQUE_URL: 'painelTimoniEstoqueUrl',
    MOTORISTA_URL: 'painelTimoniMotoristaUrl',
    COMPRAS_URL: 'painelTimoniComprasUrl',
    AGENDA_URL: 'painelTimoniAgendaUrl',
    AGENDA_TOKEN: 'painelTimoniAgendaToken'
  });

  const WEBAPP_URL_RE = /^https:\/\/script\.google\.com\/.*\/exec(\?.*)?$/;
  const HTTPS_URL_RE = /^https:\/\/.+/;

  function get(key) {
    try {
      return localStorage.getItem(key) || '';
    } catch (e) {
      return '';
    }
  }

  function set(key, value, validate, mensagemErro) {
    const limpa = (value || '').trim().replace(/\/$/, '');
    if (limpa && validate && !validate.test(limpa)) {
      throw new Error(mensagemErro);
    }
    try {
      if (limpa) localStorage.setItem(key, limpa);
      else localStorage.removeItem(key);
    } catch (e) {
      // localStorage indisponível (ex.: modo privado sem suporte) — segue sem persistir.
    }
    return limpa;
  }

  root.PainelConfig = {
    getEstoqueUrl: () => get(KEYS.ESTOQUE_URL),
    setEstoqueUrl: (url) => set(KEYS.ESTOQUE_URL, url, WEBAPP_URL_RE, 'URL inválida. Cole a URL do Web App terminada em /exec.'),
    getMotoristaUrl: () => get(KEYS.MOTORISTA_URL),
    setMotoristaUrl: (url) => set(KEYS.MOTORISTA_URL, url, WEBAPP_URL_RE, 'URL inválida. Cole a URL do Web App terminada em /exec.'),
    getComprasUrl: () => get(KEYS.COMPRAS_URL),
    setComprasUrl: (url) => set(KEYS.COMPRAS_URL, url, WEBAPP_URL_RE, 'URL inválida. Cole a URL do Web App terminada em /exec.'),
    getAgendaUrl: () => get(KEYS.AGENDA_URL),
    setAgendaUrl: (url) => set(KEYS.AGENDA_URL, url, HTTPS_URL_RE, 'URL inválida. Cole a URL do Timoni Portal (https://...).'),
    getAgendaToken: () => get(KEYS.AGENDA_TOKEN),
    setAgendaToken: (token) => set(KEYS.AGENDA_TOKEN, token)
  };
})(window);
