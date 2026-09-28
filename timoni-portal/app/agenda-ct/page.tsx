import type { Metadata } from "next";
import { AgendaCTClient } from "@/app/agenda-ct/agenda-ct-client";

export const metadata: Metadata = {
  title: "Agenda CT",
};

export default function AgendaCTPage() {
  return <AgendaCTClient />;
}
