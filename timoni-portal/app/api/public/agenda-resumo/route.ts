import { NextRequest, NextResponse } from "next/server";
import { getAccessTokenFromRefreshToken, listUpcomingEvents, toApiError } from "@/lib/google-calendar";

// Rota pública (sem sessão de navegador) para o Painel Timoni — protegida por um token
// compartilhado simples (PAINEL_TIMONI_TOKEN), não pelo login do portal. É só leitura: nunca
// cria/edita/cancela evento, só resume os compromissos de hoje das duas agendas.
//
// CORS liberado (Access-Control-Allow-Origin: *) porque o Painel Timoni é uma página estática
// servida de outra origem — sem isso o navegador bloquearia a resposta no fetch() do painel.

function respond(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" }
  });
}

export async function GET(request: NextRequest) {
  const expected = process.env.PAINEL_TIMONI_TOKEN;
  if (!expected) {
    return respond({ ok: false, erro: "PAINEL_TIMONI_TOKEN não configurado no servidor." }, 500);
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token || token !== expected) {
    return respond({ ok: false, erro: "Token inválido." }, 401);
  }

  let accessToken: string;
  try {
    accessToken = await getAccessTokenFromRefreshToken();
  } catch (error) {
    // Erro de configuração (GOOGLE_REFRESH_TOKEN ausente/expirado) — mensagem direta, não
    // passa por toApiError (que é voltada a erros da própria Calendar API).
    return respond({ ok: false, erro: error instanceof Error ? error.message : String(error) }, 500);
  }

  try {
    const agora = new Date();
    const inicioHoje = new Date(agora);
    inicioHoje.setHours(0, 0, 0, 0);
    const fimHoje = new Date(agora);
    fimHoje.setHours(23, 59, 59, 999);

    const eventos = await listUpcomingEvents(accessToken, {
      timeMin: inicioHoje.toISOString(),
      timeMax: fimHoje.toISOString()
    });

    return respond({
      ok: true,
      data: {
        atualizadoEm: new Date().toISOString(),
        total: eventos.length,
        eventos: eventos.map((e) => ({
          titulo: e.summary,
          inicio: e.start,
          fim: e.end,
          calendario: e.calendarLabel,
          local: e.location || null
        }))
      }
    });
  } catch (error) {
    const { message, status } = toApiError(error);
    return respond({ ok: false, erro: message }, status);
  }
}
