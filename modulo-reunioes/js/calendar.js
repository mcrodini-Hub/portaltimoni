// Integração com o Google Calendar: agendar reuniões e listar
// próximas/passadas. Chamado diretamente via REST (fetch) com o access
// token OAuth, sem depender da biblioteca gapi.

const ReuniõesCalendar = (() => {
  const BASE = 'https://www.googleapis.com/calendar/v3';

  function calendarId() {
    return encodeURIComponent(REUNIOES_CONFIG.CALENDAR_ID);
  }

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
      throw new Error(`Erro na API do Calendar (${res.status}): ${body}`);
    }
    return res.json();
  }

  // participantes: array de e-mails; retorna o evento criado
  async function createMeeting({ titulo, inicio, fim, local, pauta, participantes }) {
    const body = {
      summary: titulo,
      description: pauta || '',
      location: local || '',
      start: { dateTime: inicio },
      end: { dateTime: fim },
      attendees: (participantes || []).map((email) => ({ email }))
    };
    return apiFetch(`/calendars/${calendarId()}/events?sendUpdates=all`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async function listUpcoming() {
    const params = new URLSearchParams({
      timeMin: new Date().toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50'
    });
    const data = await apiFetch(`/calendars/${calendarId()}/events?${params}`);
    return data.items || [];
  }

  async function listPast() {
    const params = new URLSearchParams({
      timeMax: new Date().toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50'
    });
    const data = await apiFetch(`/calendars/${calendarId()}/events?${params}`);
    return (data.items || []).reverse();
  }

  return { createMeeting, listUpcoming, listPast };
})();
