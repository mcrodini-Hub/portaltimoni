import { signOut } from "@/lib/auth";
import { canManageMotorista, entersDirectlyInPainelTimoni, hasModuleAccess, type PortalModule, type PortalUser } from "@/lib/access-control";
import Link from "next/link";
import ModuleUpdatesNav from "@/components/module-updates-nav";
import MobilePortalHeader from "@/components/mobile-portal-header";
import type { UpdateModule } from "@/lib/module-updates";
import type { PortalIconName } from "@/components/portal-icon";

const navItems: Array<{ href: string; label: string; module: PortalModule; updateModule: UpdateModule; icon: PortalIconName; color: string }> = [
  { href: "/colaboradores", label: "AVISOS", module: "painel", updateModule: "avisos", icon: "notice", color: "text-rose-700" },
  { href: "/agenda", label: "Agenda Ciça", module: "agenda", updateModule: "agenda", icon: "star", color: "text-cyan-700" },
  { href: "/dashboard/compras", label: "Compras", module: "compras", updateModule: "compras", icon: "cart", color: "text-orange-700" },
  { href: "/dashboard/conferencia-pedidos", label: "Conferência", module: "conferencia", updateModule: "conferencia", icon: "document", color: "text-rose-700" },
  { href: "/dashboard/estoque", label: "Estoque", module: "estoque", updateModule: "estoque", icon: "stock", color: "text-amber-700" },
  { href: "/dashboard/motorista-leitura", label: "Motorista", module: "motorista", updateModule: "motorista", icon: "truck", color: "text-blue-600" },
  { href: "/dashboard/reunioes", label: "Reuniões", module: "reunioes", updateModule: "reunioes", icon: "meetings", color: "text-indigo-800" },
  { href: "/dashboard/leads", label: "Leads", module: "leads", updateModule: "leads", icon: "leads", color: "text-cyan-800" },
  { href: "/espaco-equipe", label: "Espaço Equipe", module: "painel", updateModule: "espaco-equipe", icon: "team", color: "text-indigo-800" },
  { href: "/dashboard/marketing", label: "Marketing", module: "marketing", updateModule: "marketing", icon: "leads", color: "text-cyan-800" },
  { href: "/dashboard/financeiro", label: "Financeiro", module: "financeiro", updateModule: "financeiro", icon: "document", color: "text-emerald-700" },
];

export default function PortalHeader({ email, portalUser }: { email: string; portalUser?: PortalUser | null }) {
  const directPainelTimoniAccess = entersDirectlyInPainelTimoni(email, portalUser);
  const isManagement = ["mcrodini@gmail.com", "mrodini@gmail.com"].includes(email.trim().toLowerCase());
  const canViewUpdates = isManagement;
  const linkClass =
    "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white";
  const allowedItems = navItems
    .filter((item) => hasModuleAccess(email, item.module, portalUser))
    .map((item) => ({
      ...item,
      targetHref: item.module === "motorista" && canManageMotorista(email, portalUser)
        ? "/dashboard/motorista"
        : item.href,
    }));
  const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" });
  const desktopItems = [
    ...allowedItems,
    ...(isManagement ? [{ href: "/configuracoes", targetHref: "/configuracoes", label: "Configurações", updateModule: undefined }] : []),
  ].sort(byLabel);
  const mobileItems = [
    ...(!directPainelTimoniAccess ? [{ href: "/dashboard", targetHref: "/dashboard", label: "Painel", module: "painel" as PortalModule, updateModule: undefined, icon: "home" as PortalIconName, color: "text-blue-600" }] : []),
    ...allowedItems.map((item) => ({ ...item, label: item.label === "AVISOS" ? "Avisos" : item.label })),
    ...(isManagement ? [{ href: "/configuracoes", targetHref: "/configuracoes", label: "Configurações", module: "painel" as PortalModule, updateModule: undefined, icon: "settings" as PortalIconName, color: "text-slate-800" }] : []),
  ].sort(byLabel);
  const initials = email.trim().toLowerCase() === "mcrodini@gmail.com" ? "CR" : email.trim().toLowerCase() === "mrodini@gmail.com" ? "MR" : "CT";

  return (
    <header className="sticky top-0 z-40 border-b border-blue-950/50 bg-[#0F2D8F] text-white shadow-sm">
      <MobilePortalHeader items={mobileItems} showUpdates={canViewUpdates} showGuide={isManagement} initials={initials} />
      <div className="mx-auto hidden max-w-7xl flex-wrap items-center justify-between gap-x-3 px-4 sm:flex sm:flex-nowrap sm:gap-3 sm:px-6">
        {directPainelTimoniAccess ? (
          <span className="order-1 flex min-h-12 shrink-0 items-center py-3 text-base font-bold tracking-tight text-white sm:order-none">
            Casa Timoni
          </span>
        ) : (
          <Link
            href="/dashboard"
            className="order-1 flex min-h-12 shrink-0 items-center py-3 text-base font-bold tracking-tight text-white sm:order-none"
          >
            Casa Timoni
          </Link>
        )}

        <nav
          className="order-3 -mx-1 flex w-[calc(100%+0.5rem)] min-w-0 flex-none items-center gap-1 overflow-x-auto border-t border-white/10 px-1 py-2 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:border-0 sm:px-0"
          aria-label="Menu principal"
        >
          <ModuleUpdatesNav items={desktopItems} canViewUpdates={canViewUpdates} linkClass={linkClass} />
        </nav>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
          className="order-2 flex min-h-12 shrink-0 items-center sm:order-none"
        >
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
