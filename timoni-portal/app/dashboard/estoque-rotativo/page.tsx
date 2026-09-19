import type { Metadata } from "next";
import EstoqueRotativoClient from "./estoque-rotativo-client";

export const metadata: Metadata = { title: "Estoque Rotativo" };

export default function EstoqueRotativoPage() {
  return <EstoqueRotativoClient />;
}
