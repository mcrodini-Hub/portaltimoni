// Integração com o Google Sheets: registro de atas (decisões) vinculadas
// a cada reunião pelo ID do evento do Calendar. Chamado via REST (fetch)
// com o access token OAuth.

const ReuniõesSheets = (() => {
  const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

  // Colunas da planilha, nesta ordem: A=EventId, B=Data reunião, C=Título,
  // D=Participantes, E=Decisões/Notas, F=Registrado em.
  const RANGE = `${REUNIOES_CONFIG.SHEET_NAME}!A:F`;

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${ReuniõesAuth.getToken()}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Erro na API do Sheets (${res.status}): ${body}`);
    }
    return res.json();
  }

  async function appendAta({ eventId, dataReuniao, titulo, participantes, decisoes }) {
    const row = [
      eventId,
      dataReuniao,
      titulo,
      (participantes || []).join(', '),
      decisoes,
      new Date().toISOString()
    ];
    const spreadsheetId = REUNIOES_CONFIG.SPREADSHEET_ID;
    return apiFetch(
      `/${spreadsheetId}/values/${encodeURIComponent(RANGE)}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        body: JSON.stringify({ values: [row] })
      }
    );
  }

  // Retorna um mapa eventId -> última ata registrada (linhas mais recentes vencem).
  async function listAtasByEventId() {
    const spreadsheetId = REUNIOES_CONFIG.SPREADSHEET_ID;
    const data = await apiFetch(`/${spreadsheetId}/values/${encodeURIComponent(RANGE)}`);
    const rows = data.values || [];
    const map = {};
    rows.slice(1).forEach(([eventId, dataReuniao, titulo, participantes, decisoes, registradoEm]) => {
      if (!eventId) return;
      map[eventId] = { dataReuniao, titulo, participantes, decisoes, registradoEm };
    });
    return map;
  }

  return { appendAta, listAtasByEventId };
})();
