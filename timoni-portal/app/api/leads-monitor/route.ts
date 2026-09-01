import { NextResponse } from "next/server";
import { hasLeadsMonitorAccess } from "@/lib/leads-monitor-access";
import { listLeads, listProspects } from "@/lib/leads";

export const dynamic = "force-dynamic";

function nextAction(status: "atrasado" | "hoje" | "proximo" | "sem-data") {
  if (status === "atrasado") return "Realizar o contato e registrar uma nova data.";
  if (status === "hoje") return "Realizar o contato previsto para hoje.";
  if (status === "sem-data") return "Definir a data do próximo contato.";
  return "Aguardar a data programada.";
}

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET(request: Request) {
  if (!hasLeadsMonitorAccess(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers: responseHeaders });
  }

  try {
    const [leads, prospects] = await Promise.all([listLeads(), listProspects()]);
    const items = [
      ...leads.map((lead) => ({
        id: `followup:${lead.row}`,
        empresa: lead.cliente,
        vencimento: lead.proximoContato || null,
        status: lead.status,
        lista: "FOLLOW UP" as const,
        proximaAcao: nextAction(lead.status),
      })),
      ...prospects.map((prospect) => ({
        id: `prospectar:${prospect.id}`,
        empresa: prospect.cliente,
        vencimento: null,
        status: "a-prospectar" as const,
        lista: "A PROSPECTAR" as const,
        proximaAcao: "Prospectar a empresa e definir o próximo contato.",
      })),
    ];

    return NextResponse.json(
      {
        fonte: "Portal Timoni — Leads",
        geradoEm: new Date().toISOString(),
        resumo: {
          atrasados: leads.filter((lead) => lead.status === "atrasado").length,
          hoje: leads.filter((lead) => lead.status === "hoje").length,
          followUp: leads.length,
          aProspectar: prospects.length,
        },
        items,
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    console.error("[leads-monitor] Falha ao carregar dados de leitura.", error);
    return NextResponse.json(
      { error: "Não foi possível carregar os dados de Leads." },
      { status: 503, headers: responseHeaders },
    );
  }
}
