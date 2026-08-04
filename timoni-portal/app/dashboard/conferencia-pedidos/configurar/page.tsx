import type { Metadata } from "next";
import ConfigurarGeminiClient from "./ConfigurarGeminiClient";

export const metadata: Metadata = {
  title: "Configurar Gemini",
};

export default function ConfigurarGeminiPage() {
  return <ConfigurarGeminiClient />;
}
