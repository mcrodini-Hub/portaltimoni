import type { Metadata } from "next";
import MotoristaLeitura from "./motorista-leitura";

export const metadata: Metadata = {
  title: "Motorista",
};

export default function MotoristaPage() {
  return <MotoristaLeitura />;
}
