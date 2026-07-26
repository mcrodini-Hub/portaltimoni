// Camada de dados da Agenda de Motorista.
//
// Dois modos, escolhidos automaticamente conforme haja ou não uma URL de Web App configurada:
//   • MODO PLANILHA (remoto): fala com o Apps Script publicado (ver apps-script/Codigo.gs) por
//     fetch. É o modo real — a agenda fica na planilha e é compartilhada entre todos os
//     computadores (Rio Claro e Araras), em qualquer máquina.
//   • MODO LOCAL (fallback): sem URL configurada, tudo vive no localStorage deste navegador.
//     Serve para testar a interface antes de publicar a planilha; NÃO é compartilhado entre
//     computadores.
//
// Compartilhado com app.js via <script> normal (mesmo padrão do hub-pedidos-chrome / estoque-chrome).

(function (root) {
  const KEYS = Object.freeze({
    LOJA: 'agendaMotoristaLoja',
    WEBAPP_URL: 'agendaMotoristaWebAppUrl',
    VIAGENS_LOCAL: 'agendaMotoristaViagensLocal'
  });

  const LOJAS = Object.freeze({ RIO_CLARO: 'rio_claro', ARARAS: 'araras' });
  const LOJA_LABEL = Object.freeze({ rio_claro: 'Rio Claro', araras: 'Araras' });

  // -------------------------------------------------------------------------
  // localStorage helpers (assíncronos só para manter a mesma forma de chamada
  // do módulo Estoque, que usa chrome.storage.local de verdade)
  // -------------------------------------------------------------------------
  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return Promise.resolve(raw === null ? fallback : JSON.parse(raw));
    } catch (e) {
      return Promise.resolve(fallback);
    }
  }

  function set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    return Promise.resolve(value);
  }

  // -------------------------------------------------------------------------
  // Configuração: loja deste computador e URL do Web App
  // -------------------------------------------------------------------------
  async function getLoja() { return get(KEYS.LOJA, ''); }
  async function setLoja(loja) {
    if (loja !== LOJAS.RIO_CLARO && loja !== LOJAS.ARARAS) throw new Error(`Loja inválida: ${loja}`);
    return set(KEYS.LOJA, loja);
  }

  async function getWebAppUrl() { return get(KEYS.WEBAPP_URL, ''); }
  async function setWebAppUrl(url) {
    const limpa = (url || '').trim();
    if (limpa && !/^https:\/\/script\.google\.com\/.*\/exec(\?.*)?$/.test(limpa)) {
      throw new Error('URL inválida. Cole a URL do Web App terminada em /exec.');
    }
    return set(KEYS.WEBAPP_URL, limpa);
  }

  async function isRemote() { return !!(await getWebAppUrl()); }

  // -------------------------------------------------------------------------
  // Cliente do Web App (modo planilha)
  // -------------------------------------------------------------------------
  async function apiGet(params) {
    const base = await getWebAppUrl();
    if (!base) throw new Error('URL do Web App não configurada.');
    const qs = new URLSearchParams(params).toString();
    const url = base + (base.includes('?') ? '&' : '?') + qs;
    return chamar(() => fetch(url, { method: 'GET', redirect: 'follow' }));
  }

  async function apiPost(params) {
    const base = await getWebAppUrl();
    if (!base) throw new Error('URL do Web App não configurada.');
    return chamar(() => fetch(base, { method: 'POST', redirect: 'follow', body: new URLSearchParams(params) }));
  }

  async function chamar(fazerFetch) {
    let res;
    try {
      res = await fazerFetch();
    } catch (e) {
      throw new Error('Não foi possível falar com a planilha. Verifique a conexão e a URL.');
    }
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('A planilha respondeu em formato inesperado. Confira se o Web App está publicado como "Qualquer pessoa".');
    }
    if (!data || data.ok !== true) {
      throw new Error((data && data.erro) || 'Erro ao acessar a planilha.');
    }
    return data;
  }

  async function testarConexao() {
    try {
      const hoje = new Date();
      await apiGet({ action: 'mes', ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 });
      return { ok: true };
    } catch (e) {
      return { ok: false, erro: e.message };
    }
  }

  // -------------------------------------------------------------------------
  // Viagens — modo local (mapa data -> lista de viagens)
  // -------------------------------------------------------------------------
  async function lerMapaLocal() { return get(KEYS.VIAGENS_LOCAL, {}); }
  async function salvarMapaLocal(mapa) { return set(KEYS.VIAGENS_LOCAL, mapa); }

  function generateId() {
    return `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // -------------------------------------------------------------------------
  // API pública: resumo do mês (para o calendário) e viagens de um dia
  // -------------------------------------------------------------------------
  async function listarMes(ano, mes) {
    if (await isRemote()) {
      const data = await apiGet({ action: 'mes', ano, mes });
      return data.resumo || {};
    }
    const mapa = await lerMapaLocal();
    const prefixo = `${ano}-${String(mes).padStart(2, '0')}`;
    const resumo = {};
    Object.keys(mapa).forEach((dia) => {
      if (!dia.startsWith(prefixo)) return;
      const viagens = mapa[dia] || [];
      resumo[dia] = {
        entregas: viagens.filter((v) => v.tipoHorario === 'Entrega').length,
        retiradas: viagens.filter((v) => v.tipoHorario === 'Retirada').length,
        bloqueios: viagens.filter((v) => v.tipoHorario === 'Bloqueio').length
      };
    });
    return resumo;
  }

  async function listarDia(data) {
    if (await isRemote()) {
      const r = await apiGet({ action: 'dia', data });
      return (r.viagens || []).map(normalizarViagemRemota);
    }
    const mapa = await lerMapaLocal();
    return (mapa[data] || []).slice().sort((a, b) => a.ordem - b.ordem);
  }

  function normalizarViagemRemota(v) {
    let notas = [];
    try { notas = JSON.parse(v.notasJson || '[]'); } catch (e) { notas = []; }
    return { ...v, notas };
  }

  async function criarViagem(viagem) {
    if (await isRemote()) {
      const data = await apiPost({
        action: 'criar',
        ...viagem,
        dividir: viagem.dividir ? '1' : '0',
        notasJson: JSON.stringify(viagem.notas || [])
      });
      return normalizarViagemRemota(data.viagem);
    }
    const mapa = await lerMapaLocal();
    const dia = mapa[viagem.data] || [];
    const nova = {
      ...viagem,
      id: generateId(),
      ordem: dia.length,
      notas: viagem.notas || [],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    dia.push(nova);
    mapa[viagem.data] = dia;
    await salvarMapaLocal(mapa);
    return nova;
  }

  async function atualizarViagem(id, patch) {
    if (await isRemote()) {
      const data = await apiPost({
        action: 'atualizar',
        id,
        ...patch,
        ...(('dividir' in patch) ? { dividir: patch.dividir ? '1' : '0' } : {}),
        ...(('notas' in patch) ? { notasJson: JSON.stringify(patch.notas || []) } : {})
      });
      return normalizarViagemRemota(data.viagem);
    }
    const mapa = await lerMapaLocal();
    for (const dia of Object.keys(mapa)) {
      const idx = (mapa[dia] || []).findIndex((v) => v.id === id);
      if (idx === -1) continue;
      const atual = mapa[dia][idx];
      const atualizada = { ...atual, ...patch, atualizadoEm: new Date().toISOString() };
      if (patch.data && patch.data !== dia) {
        // mudou de dia: remove da lista antiga, acrescenta ao fim da nova
        mapa[dia].splice(idx, 1);
        const destino = mapa[patch.data] || [];
        atualizada.ordem = destino.length;
        destino.push(atualizada);
        mapa[patch.data] = destino;
      } else {
        mapa[dia][idx] = atualizada;
      }
      await salvarMapaLocal(mapa);
      return atualizada;
    }
    throw new Error('Viagem não encontrada.');
  }

  async function excluirViagem(id, data) {
    if (await isRemote()) {
      await apiGet({ action: 'excluir', id });
      return;
    }
    const mapa = await lerMapaLocal();
    const dia = mapa[data] || [];
    mapa[data] = dia.filter((v) => v.id !== id);
    await salvarMapaLocal(mapa);
  }

  async function reordenarDia(data, idsEmOrdem) {
    if (await isRemote()) {
      await apiPost({ action: 'reordenar', data, ordemJson: JSON.stringify(idsEmOrdem) });
      return;
    }
    const mapa = await lerMapaLocal();
    const dia = mapa[data] || [];
    const porId = Object.fromEntries(dia.map((v) => [v.id, v]));
    mapa[data] = idsEmOrdem.map((id, index) => ({ ...porId[id], ordem: index })).filter(Boolean);
    await salvarMapaLocal(mapa);
  }

  root.AgendaStore = {
    LOJAS,
    LOJA_LABEL,
    getLoja,
    setLoja,
    getWebAppUrl,
    setWebAppUrl,
    isRemote,
    testarConexao,
    listarMes,
    listarDia,
    criarViagem,
    atualizarViagem,
    excluirViagem,
    reordenarDia
  };
})(self);
