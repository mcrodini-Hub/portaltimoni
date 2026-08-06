import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import EstoqueClient from "./estoque-client";

export const metadata: Metadata = {
  title: "Estoque",
};

const ESTOQUE_GESTAO_EMAILS = new Set([
  "mcrodini@gmail.com",
  "mrodini@gmail.com",
  "comercialrc@casatimoni.com.br",
  "reginaldo@casatimoni.com.br",
]);

export default async function EstoquePage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? "";
  const isManager = ESTOQUE_GESTAO_EMAILS.has(email);

  return <EstoqueClient isManager={isManager} />;
}
