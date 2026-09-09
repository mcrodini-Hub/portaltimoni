import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import MobileUiRules from "@/components/mobile-ui-rules";

const roboto = Roboto({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Portal Timoni",
    template: "%s | Portal Timoni",
  },
  description: "Central de gestão da Casa Timoni",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/portal-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/portal-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/portal-apple-touch.png",
  },
  appleWebApp: {
    capable: true,
    title: "Portal Timoni",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${roboto.className} min-h-screen text-slate-900 antialiased`}>
        {children}
        <MobileUiRules />
      </body>
    </html>
  );
}
