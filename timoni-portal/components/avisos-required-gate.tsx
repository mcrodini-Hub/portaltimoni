"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const AVISOS_PATH = "/colaboradores";

export default function AvisosRequiredGate() {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkPendingReads() {
      try {
        const response = await fetch("/api/comunicados", { cache: "no-store" });
        const data = await response.json();
        if (!active) return;

        const pending = response.ok && Number(data.activeCount || 0) > 0;
        setBlocked(pending);

        if (pending && pathname !== AVISOS_PATH) {
          router.replace(AVISOS_PATH);
          return;
        }
      } catch {
        if (active) setBlocked(false);
      } finally {
        if (active) setChecking(false);
      }
    }

    checkPendingReads();

    const refresh = () => checkPendingReads();
    window.addEventListener("avisos:read-changed", refresh);
    window.addEventListener("comunicados:changed", refresh);

    return () => {
      active = false;
      window.removeEventListener("avisos:read-changed", refresh);
      window.removeEventListener("comunicados:changed", refresh);
    };
  }, [pathname, router]);

  useEffect(() => {
    if (!blocked || pathname === AVISOS_PATH) return;

    const preventNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href") || "";
      if (href.startsWith(AVISOS_PATH)) return;

      event.preventDefault();
      event.stopPropagation();
      router.replace(AVISOS_PATH);
    };

    document.addEventListener("click", preventNavigation, true);
    return () => document.removeEventListener("click", preventNavigation, true);
  }, [blocked, pathname, router]);

  if (!checking || pathname === AVISOS_PATH || !blocked) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/95 p-6 text-center">
      <div className="max-w-md rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-lg">
        <p className="text-lg font-semibold text-slate-950">Há avisos pendentes de leitura.</p>
        <p className="mt-2 text-sm text-slate-700">
          Confirme os avisos obrigatórios antes de continuar utilizando o Portal.
        </p>
      </div>
    </div>
  );
}
