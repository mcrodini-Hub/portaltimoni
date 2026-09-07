import { auth } from "@/lib/auth";
import { canManageMotorista, entersDirectlyInPainelTimoni, hasModuleAccess, isBoxVisible, type PortalModule } from "@/lib/access-control";
import DashboardOverviewClient from "./dashboard-overview-client";
import { redirect } from "next/navigation";

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
  if (entersDirectlyInPainelTimoni(normalizedEmail, session?.portalUser)) {
    redirect("/colaboradores");
  }
  const visible = modules.filter((item) => hasModuleAccess(email, item.module, session?.portalUser) && isBoxVisible(email, item.module, session?.portalUser));
  return <div className="pb-3 sm:pb-4">
    <header className="mb-2 sm:mb-4">
      <h1 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Painel de Controle</h1>
    </header>
    <DashboardOverviewClient
      modules={visible}
      motoristaControle={canManageMotorista(email, session?.portalUser)}
      espacoEquipeControle={GESTAO_EMAILS.has(normalizedEmail)}
      showSummaryCards={!HIDE_SUMMARY_CARDS_EMAILS.has(normalizedEmail)}
    />
  </div>;
}
