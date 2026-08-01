import type { Metadata } from "next";
import EstoqueClient from "./estoque-client";

export const metadata: Metadata = {
  title: "Estoque",
};

export default function EstoquePage() {
  return <EstoqueClient />;
}
