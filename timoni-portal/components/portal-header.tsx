import { signOut } from "@/lib/auth";
import { canManageMotorista, entersDirectlyInPainelTimoni, hasModuleAccess, type PortalModule, type PortalUser } from "@/lib/access-control";
import Link from "next/link";
import ModuleUpdatesNav from "@/components/module-updates-nav";
import type { UpdateModule } from "@/lib/module-updates";

const navItems: Array<{ href: string; label: string; module: PortalModule; updateModule: UpdateModule }> = [
  { href: "/colaboradores", label: "AVISOS", module: "painel", updateModule: "avisos" },
  { href: "/agenda", label: "Agenda Ciça", module: "agenda", updateModule: "agenda" },
  { href: "/dashboard/compras", label: "Compras", module: "compras", updateModule: "compras" },
  { href: "/dashboard/conferencia-pedidos", label: "Conferência", module: "conferencia", updateModule: "conferencia" },
  { href: "/dashboard/estoque", label: "Estoque", module: "estoque", updateModule: "estoque" },
  { href: "/dashboard/motorista-leitura", label: "Motorista", module: "motorista", updateModule: "motorista" },
  { href: "/dashboard/reunioes", label: "Reuniões", module: "reunioes", updateModule: "reunioes" },
  { href: "/dashboard/leads", label: "Leads", module: "leads", updateModule: "leads" },
  { href: "/espaco-equipe", label: "Espaço Equipe", module: "painel", updateModule: "espaco-equipe" },
  { href: "/dashboard/marketing", label: "Marketing", module: "marketing", updateModule: "marketing" },
  { href: "/dashboard/financeiro", label: "Financeiro", module: "financeiro", updateModule: "financeiro" },
];

export default function PortalHeader({ email, portalUser }: { email: string; portalUser?: PortalUser | null }) {
  const directPainelTimoniAccess = entersDirectlyInPainelTimoni(email, portalUser);
  const isCica = email.trim().toLowerCase() === "mcrodini@gmail.com";
  const canViewUpdates = ["mcrodini@gmail.com", "mrodini@gmail.com"].includes(email.trim().toLowerCase());
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

  return (
    <header className="sticky top-0 z-40 border-b border-blue-950/50 bg-[#0b1f5e] text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 px-4 sm:flex-nowrap sm:gap-3 sm:px-6">
        {directPainelTimoniAccess ? (
          <span className="order-1 flex min-h-12 shrink-0 items-center py-3 text-base font-semibold tracking-tight text-white sm:order-none">
            Casa Timoni
          </span>
        ) : (
          <Link
            href="/dashboard"
            className="order-1 flex min-h-12 shrink-0 items-center py-3 text-base font-semibold tracking-tight text-white sm:order-none"
          >
            Casa Timoni
          </Link>
        )}

        <nav
          className="order-3 -mx-1 flex w-[calc(100%+0.5rem)] min-w-0 flex-none items-center gap-1 overflow-x-auto border-t border-white/10 px-1 py-2 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:border-0 sm:px-0"
          aria-label="Menu principal"
        >
          <ModuleUpdatesNav items={allowedItems} canViewUpdates={canViewUpdates} linkClass={linkClass} />
          {isCica && <Link href="/configuracoes" className={linkClass}>Configurações</Link>}
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
