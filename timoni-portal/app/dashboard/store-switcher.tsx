"use client";

import { useEffect } from "react";

const STORAGE_KEY = "portalTimoniStoreView";

export default function StoreSwitcher() {
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, "todas");
    window.dispatchEvent(new CustomEvent("portal-store-view-change", { detail: "todas" }));
  }, []);

  return null;
}
