import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPortalUser, hasModuleAccess } from "@/lib/access-control";
import { listTeamMessages } from "@/lib/espaco-equipe";
import { listStockAlerts, type StockAlert } from "@/lib/estoque-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NotificationItem = {
  id: string;
  type: "mensagem" | "estoque";
  title: string;
  body: string;
  url: string;
};

const GESTAO_EMAILS = new Set(["mcrodini@gmail.com", "mrodini@gmail.com"]);
const ARARAS_EMAILS = new Set([
  "estoqueararascasatimoni@gmail.com",
  "comercialara@casatimoni.com.br",
  "fotoscasatimoni@gmail.com",
  "casatimoniararas@gmail.com",
]);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function unitForEmail(email: string): StockAlert["unidade"] | "geral" {
  if (GESTAO_EMAILS.has(email)) return "geral";
  if (ARARAS_EMAILS.has(email)) return "araras";
  return "rio_claro";
}

function unitLabel(unit: StockAlert["unidade"]) {
  return unit === "araras" ? "Araras" : "Rio Claro";
}

export async function GET() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email ?? "");

  if (!email || !getPortalUser(email)) {
    return NextResponse.json({ ok: false, items: [] }, { status: 401 });
  }

  const items: NotificationItem[] = [];

  if (GESTAO_EMAILS.has(email)) {
    try {
      const messages = await listTeamMessages();
      for (const message of messages.filter((item) => (item.status || "Novo").toLowerCase() === "novo").slice(0, 8)) {
        items.push({
          id: `mensagem:${message.date}:${message.employee}:${message.unit}`,
          type: "mensagem",
          title: "Nova mensagem no Painel Timoni",
          body: `${message.employee} · ${message.unit}: ${message.message.slice(0, 120)}`,
          url: "/colaboradores",
        });
      }
    } catch {
      // Se a planilha estiver indisponível, não bloqueia o Portal.
    }
  }

  if (hasModuleAccess(email, "estoque")) {
    try {
      const unit = unitForEmail(email);
      const alerts = await listStockAlerts();
      for (const alert of alerts
        .filter((item) => item.status === "pendente")
        .filter((item) => unit === "geral" || item.unidade === unit)
        .slice(0, 10)) {
        items.push({
          id: `estoque:${alert.id}`,
          type: "estoque",
          title: "Nova solicitação no Estoque",
          body: `${unitLabel(alert.unidade)} · ${alert.codigo} · ${alert.descricao}${alert.quantidade ? ` · Qtde: ${alert.quantidade}` : ""}`,
          url: "/dashboard/estoque",
        });
      }
    } catch {
      // Se a planilha estiver indisponível, não bloqueia o Portal.
    }
  }

  return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
}
