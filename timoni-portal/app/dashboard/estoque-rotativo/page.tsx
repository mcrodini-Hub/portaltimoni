import type { Metadata } from "next";
import EstoqueRotativoClient from "./estoque-rotativo-client";

export const metadata: Metadata = { title: "Rotativo" };

export default function EstoqueRotativoPage() {
  return <EstoqueRotativoClient />;
}
