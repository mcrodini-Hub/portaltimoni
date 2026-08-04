import type { Metadata } from "next";
import ConfigurarTrelloClient from "./ConfigurarTrelloClient";

export const metadata: Metadata = { title: "Configurar Trello" };

export default function ConfigurarTrelloPage() {
  return <ConfigurarTrelloClient />;
}
