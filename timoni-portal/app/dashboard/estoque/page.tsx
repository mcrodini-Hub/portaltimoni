import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import type { PortalUser } from "@/lib/access-control";
import EstoqueClient from "./estoque-client";

export const metadata: Metadata = {
  title: "Estoque",
};

type RequestUnit = "rio_claro" | "araras";

const ESTOQUE_GESTAO_EMAILS = new Set([
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

export default async function EstoquePage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? "";
  const isManager = session?.portalUser ? session.portalUser.readOnly !== true : ESTOQUE_GESTAO_EMAILS.has(email);
  const defaultUnit = resolveDefaultUnit(email, session?.portalUser);
  const allowedUnits = resolveAllowedUnits(email, isManager, session?.portalUser);
  const canDelete = email === "mcrodini@gmail.com";
  const canEdit = email === "mcrodini@gmail.com";
  const showRequestForm = email !== "mcrodini@gmail.com";
  const showManagerResponseField = email !== "mcrodini@gmail.com";

  return <EstoqueClient isManager={isManager} canDelete={canDelete} canEdit={canEdit} showRequestForm={showRequestForm} showManagerResponseField={showManagerResponseField} defaultUnit={defaultUnit} allowedUnits={allowedUnits} />;
}
