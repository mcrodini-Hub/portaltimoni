"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import AvisosNavLink from "@/components/avisos-nav-link";
import type { UpdateModule } from "@/lib/module-updates";
import { useModuleUpdates } from "@/components/module-updates-store";

type NavItem = {
  href: string;
  targetHref: string;
  label: string;
  updateModule?: UpdateModule;
  external?: boolean;
};


export default function ModuleUpdatesNav({
  items,
  canViewUpdates,
  linkClass,
}: {
  items: NavItem[];
  canViewUpdates: boolean;
  linkClass: string;
}) {
  const pathname = usePathname();
  const { updates, markRead } = useModuleUpdates(canViewUpdates);

  useEffect(() => {
    if (!canViewUpdates) return;
    const activeItem = items
      .filter((item) => !item.external && (pathname === item.targetHref || pathname.startsWith(`${item.targetHref}/`)))
      .sort((a, b) => b.targetHref.length - a.targetHref.length)[0];
    if (!activeItem?.updateModule) return;
    const pending = updates[activeItem.updateModule];
    if (pending) void markRead(pending.module, true);
  }, [canViewUpdates, items, markRead, pathname, updates]);

  return items.map((item) => {
    const pending = item.updateModule ? updates[item.updateModule] : undefined;
    const content = <span>{item.label}</span>;
    return (
      <span key={item.href} className="inline-flex shrink-0">
        {item.href === "/colaboradores" && !canViewUpdates ? (
          <AvisosNavLink className={linkClass} showActiveCount={!canViewUpdates} />
        ) : (
          <Link
            href={item.targetHref}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noopener noreferrer" : undefined}
            onClick={() => pending && void markRead(pending.module, true)}
            className={`${linkClass} inline-flex items-center gap-2`}
            aria-label={pending ? `${item.label} tem novidades. Abrir e visualizar.` : item.label}
          >
            {content}
            {pending && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 shadow-[0_0_0_2px_rgba(255,255,255,0.22)]" aria-hidden="true" />}
          </Link>
        )}
      </span>
    );
  });
}
