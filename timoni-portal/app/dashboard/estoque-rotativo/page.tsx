import type { Metadata } from "next";
import AutoOpenStandardizationSheet from "./auto-open-standardization-sheet";
import EstoqueRotativoClient from "./estoque-rotativo-client";

export const metadata: Metadata = { title: "Estoque Rotativo" };

export default function EstoqueRotativoPage() {
  return (
    <>
      <AutoOpenStandardizationSheet />
      <EstoqueRotativoClient />
    </>
  );
}
