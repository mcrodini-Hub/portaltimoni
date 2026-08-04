import { NextResponse } from "next/server";
import { fromZonedTime } from "date-fns-tz";
import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { listEventsInRange, toApiError, TIME_ZONE } from "@/lib/google-calendar";

function limitesDeHojeEmSaoPaulo(): { inicioHoje: Date; fimHoje: Date } {
  const hojeStr = new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
  return {
    inicioHoje: fromZonedTime(`${hojeStr}T00:00:00.000`, TIME_ZONE),
    fimHoje: fromZonedTime(`${hojeStr}T23:59:59.999`, TIME_ZONE),
  };
}

function respond(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return respond({ ok: false, erro: "Sessão expirada. Entre novamente no Portal." }, 401);
  }
  if (!hasModuleAccess(email, "painel")) {
    return respond({ ok: false, erro: "Acesso não autorizado ao Painel Timoni." }, 403);
  }
  if (!session.accessToken || session.error === "RefreshAccessTokenError") {
    return respond({ ok: false, erro: "Sessão do Google expirada. Saia e entre novamente no Portal." }, 401);
  }

  try {
    const { inicioHoje, fimHoje } = limitesDeHojeEmSaoPaulo();
    const eventos = await listEventsInRange(session.accessToken, {
      timeMin: inicioHoje.toISOString(),
      timeMax: fimHoje.toISOString(),
    });

    return respond({
      ok: true,
      data: {
        atualizadoEm: new Date().toISOString(),
        total: eventos.length,
        eventos: eventos.map((event) => ({
          titulo: event.summary,
          inicio: event.start,
          fim: event.end,
          calendario: event.calendarLabel,
          local: event.location || null,
        })),
      },
    });
  } catch (error) {
    const { message, status } = toApiError(error);
    return respond({ ok: false, erro: message }, status);
  }
}
