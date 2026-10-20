import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { hasModuleAccess, type PortalUser } from "@/lib/access-control";
import { getEffectivePortalUser } from "@/lib/portal-config";
import { redirect } from "next/navigation";
import PedidoCompraClient from "./pedido-compra-client";

export const metadata: Metadata = { title: "Pedidos de Compra" };
type RequestUnit = "rio_claro" | "araras";

const PURCHASE_OVERVIEW_EMAILS = new Set([
  "estoqueararascasatimoni@gmail.com",
  "estoquetimoni@gmail.com",
  "mcrodini@gmail.com",
  "mrodini@gmail.com",
]);

const ARARAS_EMAILS = new Set([
  "fotoscasatimoni@gmail.com",
  "comercialara@casatimoni.com.br",
  "reginaldo@casatimoni.com.br",
  "casatimoniararas@gmail.com",
  "estoqueararascasatimoni@gmail.com",
]);

const RIO_CLARO_EMAILS = new Set([
  "balcaotimoni@gmail.com",
  "estoquetimoni@gmail.com",
  "marketplacerc.mcr@gmail.com",
  "comercialrc@casatimoni.com.br",
  "carolina@casatimoni.com.br",
]);

function resolveDefaultUnit(email: string, portalUser?: PortalUser | null): RequestUnit {
  if (portalUser?.unit === "Araras") return "araras";
  if (portalUser?.unit === "Rio Claro") return "rio_claro";
  if (ARARAS_EMAILS.has(email)) return "araras";
  return "rio_claro";
}

function resolveAllowedUnits(email: string, isManager: boolean, portalUser?: PortalUser | null): RequestUnit[] {
  if (portalUser?.unit === "Geral") return ["rio_claro", "araras"];
  if (portalUser?.unit === "Araras") return ["araras"];
  if (portalUser?.unit === "Rio Claro") return ["rio_claro"];
  if (email === "mcrodini@gmail.com" || email === "mrodini@gmail.com") return ["rio_claro", "araras"];
  if (ARARAS_EMAILS.has(email)) return ["araras"];
  if (RIO_CLARO_EMAILS.has(email)) return ["rio_claro"];
  return isManager ? ["rio_claro", "araras"] : [resolveDefaultUnit(email, portalUser)];
}

export default async function PedidoCompraPage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? "";
  const portalUser = await getEffectivePortalUser(session?.accessToken, email);
  if (!hasModuleAccess(email, "pedido-de-compra", portalUser)) redirect("/login?error=AccessDenied");
  const isManager = PURCHASE_OVERVIEW_EMAILS.has(email);
  const allowedUnits = resolveAllowedUnits(email, isManager, portalUser);
  const visibleUnits: RequestUnit[] = isManager || allowedUnits.length > 1 ? ["rio_claro", "araras"] : allowedUnits;
  return <PedidoCompraClient visibleUnits={visibleUnits} />;
}

