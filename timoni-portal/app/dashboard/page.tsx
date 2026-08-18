import { auth } from "@/lib/auth";
import { hasModuleAccess, isReadOnlyUser, type PortalModule } from "@/lib/access-control";
import DashboardOverviewClient from "./dashboard-overview-client";

const modules: Array<{
  module: PortalModule;
  name: string;
  href: string;
  icon: string;
  accent: string;
}> = [
  { module: "painel", name: "Painel Timoni", href: "/colaboradores", icon: "📢", accent: "border-indigo-200 bg-indigo-50" },
  { module: "agenda", name: "Agenda da Ciça", href: "/agenda", icon: "📅", accent: "border-violet-200 bg-violet-50" },
  { module: "compras", name: "Compras", href: "/dashboard/compras", icon: "🛒", accent: "border-blue-200 bg-blue-50" },
  { module: "conferencia", name: "Conferência de Preços", href: "/dashboard/conferencia-pedidos", icon: "✅", accent: "border-cyan-200 bg-cyan-50" },
  { module: "estoque", name: "Estoque", href: "/dashboard/estoque", icon: "📦", accent: "border-emerald-200 bg-emerald-50" },
  { module: "financeiro", name: "Financeiro", href: "/dashboard/financeiro", icon: "💰", accent: "border-lime-200 bg-lime-50" },
  { module: "marketing", name: "Marketing", href: "/dashboard/marketing", icon: "📣", accent: "border-pink-200 bg-pink-50" },
  { module: "motorista", name: "Motorista", href: "/dashboard/motorista", icon: "🚚", accent: "border-amber-200 bg-amber-50" },
  { module: "reunioes", name: "Reuniões", href: "/dashboard/reunioes", icon: "👥", accent: "border-rose-200 bg-rose-50" },
];

export default async function DashboardPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const visible = modules.filter((item) => hasModuleAccess(email, item.module));
  const readOnly = isReadOnlyUser(email);

  return (
    <div className="pb-4">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">Casa Timoni</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Painel de Controle</h1>
          <p className="mt-1 text-sm text-slate-600">O que precisa da sua atenção agora.</p>
        </div>
        {readOnly && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Somente leitura</span>}
      </header>

      <DashboardOverviewClient modules={visible} readOnly={readOnly} />

      <footer className="mt-5 border-t border-slate-200 pt-3 text-center text-[11px] text-slate-400">
        Portal Timoni · Agosto 2026
      </footer>
    </div>
  );
}
