"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const CHANGE_CHECK_MS = 60_000;

export default function PortalPermissionsSync() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login") return;

    let checking = false;
    let refreshRequested = false;

    const checkForChanges = async () => {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const response = await fetch("/api/configuracoes/version", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { changed?: boolean };
        if (result.changed && !refreshRequested) {
          refreshRequested = true;
          router.refresh();
        } else if (!result.changed) {
          refreshRequested = false;
        }
      } catch {
        // A falha temporária na checagem não deve interromper o uso do Portal.
      } finally {
        checking = false;
      }
    };

    void checkForChanges();
    const interval = window.setInterval(() => void checkForChanges(), CHANGE_CHECK_MS);
    const onFocus = () => void checkForChanges();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkForChanges();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pathname, router]);

  return null;
}
