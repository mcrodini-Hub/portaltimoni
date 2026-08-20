import type { Metadata } from "next";
import MotoristaLeitura from "./motorista-leitura";

export const metadata: Metadata = {
  title: "Motorista",
  description: "Acesso do motorista da Casa Timoni",
  manifest: "/motorista-manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/motorista-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/motorista-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/motorista-apple-touch.png",
  },
  appleWebApp: {
    capable: true,
    title: "Motorista",
    statusBarStyle: "default",
  },
};

export default function MotoristaPage() {
  return <MotoristaLeitura />;
}
