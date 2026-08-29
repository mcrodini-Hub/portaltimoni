"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AvisosNavLink({ className }: { className: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/comunicados", { cache: "no-store" });
        const data = await response.json();
        if (active && response.ok) {
          setCount(Number(data.activeCount || 0));
        }
      } catch {
        if (active) setCount(0);
      }
    }
    load();
    const interval = window.setInterval(load, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <Link href="/colaboradores" className={`${className} inline-flex items-center gap-2`}>
      <span>AVISOS</span>
      {count > 0 && (
        <span className="min-w-5 rounded-full bg-amber-400 px-1.5 py-0.5 text-center text-[11px] font-bold leading-4 text-blue-950">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
