import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import EstoqueClient from "./estoque-client";
import { isCicaAdmin } from "@/lib/access-control";

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
  "casatimoniararas@gmail.com",
  "estoqueararascasatimoni@gmail.com",
]);

const RIO_CLARO_EMAILS = new Set([
  "balcaotimoni@gmail.com",
  "estoquetimoni@gmail.com",
  "marketplacerc.mcr@gmail.com",
  "comercialrc@casatimoni.com.br",
  "caixatimonirioclaro@gmail.com",
  "carolina@casatimoni.com.br",
]);

function resolveDefaultUnit(email: string): RequestUnit {
  if (ARARAS_EMAILS.has(email)) return "araras";
  return "rio_claro";
}

function resolveAllowedUnits(email: string, isManager: boolean): RequestUnit[] {
  if (email === "mcrodini@gmail.com" || email === "mrodini@gmail.com") return ["rio_claro", "araras"];
  if (ARARAS_EMAILS.has(email)) return ["araras"];
  if (RIO_CLARO_EMAILS.has(email)) return ["rio_claro"];
  return isManager ? ["rio_claro", "araras"] : [resolveDefaultUnit(email)];
}

export default async function EstoquePage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? "";
  const isManager = ESTOQUE_GESTAO_EMAILS.has(email);
  const defaultUnit = resolveDefaultUnit(email);
  const allowedUnits = resolveAllowedUnits(email, isManager);

  return <EstoqueClient isManager={isManager} canDelete={isCicaAdmin(email)} defaultUnit={defaultUnit} allowedUnits={allowedUnits} />;
}
