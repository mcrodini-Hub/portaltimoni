import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Portal Timoni",
    template: "%s | Portal Timoni",
  },
  description: "Central de gestão da Casa Timoni",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen text-slate-900 antialiased">{children}</body>
    </html>
  );
}
