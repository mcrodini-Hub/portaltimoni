import type { Metadata } from "next";
import ConfigurarGeminiClient from "./ConfigurarGeminiClient";

export const metadata: Metadata = {
  title: "Configurar Conferência de Preços",
};

export default function ConfigurarConferenciaPage() {
  return <ConfigurarGeminiClient />;
}
