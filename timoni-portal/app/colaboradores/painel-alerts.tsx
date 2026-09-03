import Link from "next/link";
import { listTeamMessages } from "@/lib/espaco-equipe";
import { listStockAlerts, type StockAlert } from "@/lib/estoque-alerts";

const TEAM_MESSAGE_ALERT_EMAILS = new Set([
  "mcrodini@gmail.com",
  "mrodini@gmail.com",
]);

const STOCK_ALERT_EMAILS = new Set([
  "mcrodini@gmail.com",
  "estoquetimoni@gmail.com",
  "comercialrc@casatimoni.com.br",
  "estoqueararascasatimoni@gmail.com",
]);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function unitLabel(unit: StockAlert["unidade"]) {
  return unit === "araras" ? "Araras" : "Rio Claro";
}

function stockUnitForEmail(email: string): StockAlert["unidade"] | "geral" {
  if (email === "estoqueararascasatimoni@gmail.com") return "araras";
  if (["estoquetimoni@gmail.com", "comercialrc@casatimoni.com.br"].includes(email)) return "rio_claro";
  return "geral";
}

export default async function PainelAlerts({ email, accessToken }: { email: string; accessToken?: string }) {
  const normalizedEmail = normalizeEmail(email);
  const showTeamMessages = TEAM_MESSAGE_ALERT_EMAILS.has(normalizedEmail);
  const showStockAlerts = STOCK_ALERT_EMAILS.has(normalizedEmail);

  if (!showTeamMessages && !showStockAlerts) return null;

  let newMessages: Awaited<ReturnType<typeof listTeamMessages>> = [];
  let stockAlerts: StockAlert[] = [];

  if (showTeamMessages) {
    try {
      const messages = await listTeamMessages(accessToken);
      newMessages = messages.filter((message) => (message.status || "Novo").toLowerCase() === "novo");
    } catch {
      newMessages = [];
    }
  }

  if (showStockAlerts) {
    try {
      const unit = stockUnitForEmail(normalizedEmail);
      const alerts = await listStockAlerts();
      stockAlerts = alerts
        .filter((alert) => alert.status === "pendente")
        .filter((alert) => unit === "geral" || alert.unidade === unit);
    } catch {
      stockAlerts = [];
    }
  }

  if (!newMessages.length && !stockAlerts.length) return null;

  return (
    <section className="mb-5 grid gap-4 lg:grid-cols-2">
      {showTeamMessages && newMessages.length > 0 && (
        <article className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Aviso do Painel</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                {newMessages.length} mensagem{newMessages.length === 1 ? "" : "s"} recebida{newMessages.length === 1 ? "" : "s"}
              </h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm">Novo</span>
          </div>
          <div className="mt-4 space-y-2">
            {newMessages.slice(0, 3).map((message, index) => (
              <div key={`${message.date}-${index}`} className="rounded-2xl bg-white/80 p-3 text-sm text-slate-700">
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(message.date)}</p>
                <p className="mt-2 line-clamp-2">{message.message}</p>
              </div>
            ))}
          </div>
        </article>
      )}

      {showStockAlerts && stockAlerts.length > 0 && (
        <article className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Aviso do Estoque</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">
                {stockAlerts.length} solicitação{stockAlerts.length === 1 ? "" : "ões"} nova{stockAlerts.length === 1 ? "" : "s"}
              </h2>
            </div>
            <Link href="/dashboard/estoque" className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100">
              Abrir Estoque →
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {stockAlerts.slice(0, 4).map((alert) => (
              <div key={alert.id} className="rounded-2xl bg-white/80 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-950">{alert.codigo} · {alert.descricao}</p>
                <p className="mt-1 text-xs text-slate-500">{unitLabel(alert.unidade)} · {formatDateTime(alert.criadoEm)}</p>
                <p className="mt-2">Vendedor: {alert.vendedor || "não informado"}{alert.quantidade ? ` · Qtde: ${alert.quantidade}` : ""}</p>
              </div>
            ))}
          </div>
        </article>
      )}
    </section>
  );
}
