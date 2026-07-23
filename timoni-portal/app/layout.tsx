import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Timoni Portal",
  description: "Agenda Google integrada ao Timoni Portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen text-slate-900 antialiased">{children}</body>
    </html>
  );
}
