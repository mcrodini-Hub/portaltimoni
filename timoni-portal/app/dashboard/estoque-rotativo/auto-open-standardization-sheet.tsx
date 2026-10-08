"use client";

import { useEffect } from "react";

export default function AutoOpenStandardizationSheet() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target;
      const button = target instanceof Element ? target.closest("button") : null;
      if (!button || button.textContent?.trim() !== "Padronizar e conferir") return;

      const details = button.closest("details");
      if (!details || details.querySelector("summary")?.textContent?.trim() !== "Padronização das planilhas") return;

      const supplierSelect = details.querySelector("select") as HTMLSelectElement | null;
      const spreadsheetId = supplierSelect?.value.trim();
      if (!spreadsheetId) return;

      window.open(
        `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit`,
        "_blank",
        "noopener,noreferrer",
      );
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
