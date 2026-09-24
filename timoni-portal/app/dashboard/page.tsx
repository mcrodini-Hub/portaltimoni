import { auth } from "@/lib/auth";
import { canManageMotorista, hasModuleAccess, type PortalModule } from "@/lib/access-control";
import { redirect } from "next/navigation";

const destinations: Array<{ module: PortalModule; href: string }> = [
  { module: "painel", href: "/colaboradores" },
  { module: "agenda", href: "/agenda" },
  { module: "agenda-ct", href: "/agenda-ct" },
  { module: "compras", href: "/dashboard/compras" },
  { module: "conferencia", href: "/dashboard/conferencia-pedidos" },
  { module: "estoque", href: "/dashboard/estoque" },
  { module: "estoque-rotativo", href: "/dashboard/estoque-rotativo" },
  { module: "motorista", href: "/dashboard/motorista-leitura" },
  { module: "reunioes", href: "/dashboard/reunioes" },
  { module: "leads", href: "/dashboard/leads" },
  { module: "marketing", href: "/dashboard/marketing" },
  { module: "financeiro", href: "/dashboard/financeiro" },
];

export default async function DashboardPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const target = destinations.find((item) => hasModuleAccess(email, item.module, session?.portalUser));

  if (!target) redirect("/login?error=AccessDenied");
  if (target.module === "motorista" && canManageMotorista(email, session?.portalUser)) {
    redirect("/dashboard/motorista");
  }
  redirect(target.href);
}
