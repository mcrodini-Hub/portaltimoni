import type { Metadata } from "next";
import MotoristaLeitura from "./motorista-leitura";

export const metadata: Metadata = {
  title: "Agenda do Motorista | Casa Timoni",
};

export default function MotoristaPage() {
  return <MotoristaLeitura />;
}
