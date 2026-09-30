"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const CHANGE_CHECK_MS = 60_000;

type RevisionResponse = { revision?: string; sessionRevision?: string };

export default function PortalPermissionsSync() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login" || pathname === "/dashboard/estoque-rotativo") return;

    let checking = false;
    let lastSeenRevision: string | null = null;

    const checkForChanges = async () => {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const response = await fetch("/api/configuracoes/version", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as RevisionResponse;
        if (!result.revision) return;

        const changed = lastSeenRevision === null
          ? result.sessionRevision !== result.revision
          : lastSeenRevision !== result.revision;
        lastSeenRevision = result.revision;

        if (changed) router.refresh();
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
