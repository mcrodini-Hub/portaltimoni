import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPortalUser, hasModuleAccess, type PortalUser } from "@/lib/access-control";
import { listTeamMessages } from "@/lib/espaco-equipe";
import { listStockAlerts, type StockAlert } from "@/lib/estoque-alerts";
import { listComunicados } from "@/lib/comunicados";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NotificationItem = {
  id: string;
  type: "mensagem" | "estoque" | "comunicado";
  title: string;
  body: string;
  url: string;
};

const GESTAO_EMAILS = new Set(["mcrodini@gmail.com", "mrodini@gmail.com"]);
const ARARAS_EMAILS = new Set([
  "estoqueararascasatimoni@gmail.com",
  "comercialara@casatimoni.com.br",
  "fotoscasatimoni@gmail.com",
  "reginaldo@casatimoni.com.br",
  "casatimoniararas@gmail.com",
]);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function unitForEmail(email: string, portalUser?: PortalUser | null): StockAlert["unidade"] | "geral" {
  if (portalUser?.unit === "Geral") return "geral";
  if (portalUser?.unit === "Araras") return "araras";
  if (portalUser?.unit === "Rio Claro") return "rio_claro";
  if (GESTAO_EMAILS.has(email)) return "geral";
  if (ARARAS_EMAILS.has(email)) return "araras";
  return "rio_claro";
}

function unitLabel(unit: StockAlert["unidade"]) {
  return unit === "araras" ? "Araras" : "Rio Claro";
}

function logIntegrationError(area: string, error: unknown) {
  if (error instanceof Error) {
    console.error(`[Painel Timoni] ${area}: ${error.name}: ${error.message}`);
    return;
  }
  console.error(`[Painel Timoni] ${area}: falha desconhecida`);
}

function isWithinDisplayEndDate(value: string, now = Date.now()) {
  if (!value) return true;
  const expiresAt = new Date(value);
  if (Number.isNaN(expiresAt.getTime())) return false;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(expiresAt);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return now < Date.UTC(year, month - 1, day + 1, 3);
}

export async function GET() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email ?? "");

  if (!email || !getPortalUser(email, session?.portalUser)) {
    return NextResponse.json({ ok: false, items: [] }, { status: 401 });
  }

  const items: NotificationItem[] = [];

  {
    try {
      const now = Date.now();
      const unit = unitForEmail(email, session?.portalUser);
      const notices = await listComunicados(session?.accessToken ?? "");
      for (const notice of notices
        .filter((item) => item.status === "ativo")
        .filter((item) => !item.startsAt || Date.parse(item.startsAt) <= now)
        .filter((item) => isWithinDisplayEndDate(item.expiresAt, now))
        .filter((item) => unit === "geral" || item.unit === "geral" || item.unit.replace("_", " ") === unit.replace("_", " "))
        .slice(0, 10)) {
        items.push({
          id: `comunicado:${notice.id}:${notice.updatedAt}`,
          type: "comunicado",
          title: notice.title,
          body: notice.message.slice(0, 140),
          url: "/colaboradores",
        });
      }
    } catch (error) {
      logIntegrationError("Comunicados / leitura", error);
    }
  }

  if (GESTAO_EMAILS.has(email)) {
    try {
      const messages = await listTeamMessages(session?.accessToken);
      for (const message of messages.filter((item) => (item.status || "Novo").toLowerCase() === "novo").slice(0, 8)) {
        items.push({
          id: `mensagem:${message.date}:${message.employee}:${message.unit}`,
          type: "mensagem",
          title: "Nova mensagem no Painel Timoni",
          body: `${message.employee} · ${message.unit}: ${message.message.slice(0, 120)}`,
          url: "/colaboradores",
        });
      }
    } catch (error) {
      logIntegrationError("Espaço Equipe / leitura", error);
    }
  }

  if (hasModuleAccess(email, "estoque", session?.portalUser)) {
    try {
      const unit = unitForEmail(email, session?.portalUser);
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
    } catch (error) {
      logIntegrationError("Estoque / leitura de alertas", error);
    }
  }

  return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
}
