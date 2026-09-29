"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Keep permissions reasonably fresh without reloading the whole Portal every few seconds.
const PERMISSION_REFRESH_MS = 120_000;
const REFRESH_COOLDOWN_MS = 5_000;

export default function PortalPermissionsSync() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login") return;

    let lastRefreshAt = 0;
    const refreshPermissions = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefreshAt < REFRESH_COOLDOWN_MS) return;
      lastRefreshAt = now;
      router.refresh();
    };

    const interval = window.setInterval(refreshPermissions, PERMISSION_REFRESH_MS);
    const onFocus = () => refreshPermissions();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshPermissions();
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
