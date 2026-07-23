// Configuração do Painel Timoni: URLs dos Web Apps (Apps Script) dos módulos que já expõem
// dados via planilha. Guardado em localStorage — o painel é uma página estática, sem login,
// pensada para uso pessoal (mesmo padrão de "modo planilha" do Estoque e do Motorista).

(function (root) {
  const KEYS = Object.freeze({
    ESTOQUE_URL: 'painelTimoniEstoqueUrl',
    MOTORISTA_URL: 'painelTimoniMotoristaUrl'
  });

  const WEBAPP_URL_RE = /^https:\/\/script\.google\.com\/.*\/exec(\?.*)?$/;

  function get(key) {
    try {
      return localStorage.getItem(key) || '';
    } catch (e) {
      return '';
    }
  }

  function set(key, value) {
    const limpa = (value || '').trim();
    if (limpa && !WEBAPP_URL_RE.test(limpa)) {
      throw new Error('URL inválida. Cole a URL do Web App terminada em /exec.');
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
    setEstoqueUrl: (url) => set(KEYS.ESTOQUE_URL, url),
    getMotoristaUrl: () => get(KEYS.MOTORISTA_URL),
    setMotoristaUrl: (url) => set(KEYS.MOTORISTA_URL, url)
  };
})(window);
