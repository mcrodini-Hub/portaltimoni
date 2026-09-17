"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const PERMISSION_REFRESH_MS = 20_000;

export default function PortalPermissionsSync() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login") return;

    const refreshPermissions = () => {
      if (document.visibilityState === "visible") router.refresh();
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
