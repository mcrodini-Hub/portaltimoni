import { auth } from "@/lib/auth";
import { canManageMotorista, hasModuleAccess, type PortalModule } from "@/lib/access-control";
import DashboardOverviewClient from "./dashboard-overview-client";

const modules: Array<{ module: PortalModule; name: string; href: string; icon: string; accent: string }> = [
  { module: "painel", name: "Painel Timoni", href: "/colaboradores", icon: "📢", accent: "" },
  { module: "agenda", name: "Agenda", href: "/agenda", icon: "📅", accent: "" },
  { module: "compras", name: "Compras", href: "/dashboard/compras", icon: "🛒", accent: "" },
  { module: "conferencia", name: "Conferência", href: "/dashboard/conferencia-pedidos", icon: "📄", accent: "" },
  { module: "estoque", name: "Estoque", href: "/dashboard/estoque", icon: "📦", accent: "" },
  { module: "motorista", name: "Motorista", href: "/dashboard/motorista-leitura", icon: "🚚", accent: "" },
  { module: "reunioes", name: "Reuniões", href: "/dashboard/reunioes", icon: "👥", accent: "" },
  { module: "leads", name: "Leads", href: "/dashboard/leads", icon: "🎯", accent: "" },
];
const GESTAO_EMAILS = new Set(["mcrodini@gmail.com", "mrodini@gmail.com"]);
const HIDE_SUMMARY_CARDS_EMAILS = new Set([
  "marketplacerc.mcr@gmail.com",
  "comercialrc@casatimoni.com.br",
  "comercialara@casatimoni.com.br",
  "mrodini@gmail.com",
]);

export default async function DashboardPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const normalizedEmail = email.trim().toLowerCase();
  const visible = modules.filter((item) => hasModuleAccess(email, item.module));
  return <div className="pb-4">
    <header className="mb-6">
      <div><h1 className="text-2xl font-semibold tracking-tight text-slate-950">Painel de Controle</h1><p className="mt-1 text-sm text-slate-600">Visão geral do que está acontecendo na Casa Timoni.</p></div>
    </header>
    <DashboardOverviewClient
      modules={visible}
      motoristaControle={canManageMotorista(email)}
      espacoEquipeControle={GESTAO_EMAILS.has(normalizedEmail)}
      showSummaryCards={!HIDE_SUMMARY_CARDS_EMAILS.has(normalizedEmail)}
    />
  </div>;
}
