"use client";

import { useEffect, useState } from "react";

type StoreView = "todas" | "rio_claro" | "araras";

const STORAGE_KEY = "portalTimoniStoreView";
const options: Array<{ value: StoreView; label: string }> = [
  { value: "todas", label: "Todas" },
  { value: "rio_claro", label: "Rio Claro" },
  { value: "araras", label: "Araras" },
];

export default function StoreSwitcher() {
  const [view, setView] = useState<StoreView>("todas");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as StoreView | null;
    if (saved === "rio_claro" || saved === "araras" || saved === "todas") setView(saved);
  }, []);

  function changeView(next: StoreView) {
    setView(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent("portal-store-view-change", { detail: next }));
  }

  return (
    <div className="mx-auto flex max-w-7xl justify-end px-4 pt-3 sm:px-6">
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => changeView(option.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              view === option.value ? "bg-blue-700 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
