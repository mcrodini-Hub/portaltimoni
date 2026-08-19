import Link from "next/link";
import { auth } from "@/lib/auth";
import { canManageMotorista, hasModuleAccess, type PortalModule } from "@/lib/access-control";
import { listLeads } from "@/lib/leads";
import DashboardOverviewClient from "./dashboard-overview-client";

const modules: Array<{ module: PortalModule; name: string; href: string; icon: string; accent: string }> = [
  { module: "painel", name: "Painel Timoni", href: "/colaboradores", icon: "📢", accent: "border-indigo-200 bg-indigo-50" },
  { module: "agenda", name: "Agenda da Ciça", href: "/agenda", icon: "📅", accent: "border-violet-200 bg-violet-50" },
  { module: "compras", name: "Compras", href: "/dashboard/compras", icon: "🛒", accent: "border-blue-200 bg-blue-50" },
  { module: "conferencia", name: "Conferência de Preços", href: "/dashboard/conferencia-pedidos", icon: "✅", accent: "border-cyan-200 bg-cyan-50" },
  { module: "estoque", name: "Estoque", href: "/dashboard/estoque", icon: "📦", accent: "border-emerald-200 bg-emerald-50" },
  { module: "motorista", name: "Visualização Motorista", href: "/dashboard/motorista-leitura", icon: "🚚", accent: "border-amber-200 bg-amber-50" },
  { module: "reunioes", name: "Reuniões", href: "/dashboard/reunioes", icon: "👥", accent: "border-rose-200 bg-rose-50" },
  { module: "leads", name: "Leads", href: "/dashboard/leads", icon: "🎯", accent: "border-red-200 bg-red-50" },
];

const GESTAO_EMAILS = new Set(["mcrodini@gmail.com", "mrodini@gmail.com"]);

export default async function DashboardPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const normalizedEmail = email.trim().toLowerCase();
  const visible = modules.filter((item) => hasModuleAccess(email, item.module));
  let leadPending: number | null = null;
  let leadLate = 0;
  if (hasModuleAccess(email, "leads")) {
    try {
      const leads = await listLeads();
      leadLate = leads.filter((x) => x.status === "atrasado").length;
      leadPending = leadLate + leads.filter((x) => x.status === "hoje").length;
    } catch { leadPending = null; }
  }
  return <div className="pb-4">
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">Casa Timoni</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Painel de Controle</h1><p className="mt-1 text-sm text-slate-600">O que precisa da sua atenção agora.</p></div></header>
    {hasModuleAccess(email,"leads") && <Link href="/dashboard/leads" className="mb-3 block rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-red-700">Leads · Follow-up</p><p className="mt-2 text-3xl font-bold text-slate-950">{leadPending ?? "—"}</p><p className="text-xs text-slate-600">contatos para agir hoje</p></div>{leadLate>0 && <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">{leadLate} atrasado{leadLate===1?"":"s"}</span>}</div></Link>}
    <DashboardOverviewClient modules={visible} motoristaControle={canManageMotorista(email)} espacoEquipeControle={GESTAO_EMAILS.has(normalizedEmail)} />
    <footer className="mt-5 border-t border-slate-200 pt-3 text-center text-[11px] text-slate-400">Portal Timoni · Agosto 2026</footer>
  </div>;
}
