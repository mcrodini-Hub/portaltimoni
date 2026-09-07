"use client";

import type { ReactNode } from "react";

export function Modal({
  title,
  onClose,
  children,
  className = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/30 p-2 sm:p-4">
      <div
        className={`flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-xl bg-white shadow-lg sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl ${className}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="min-w-0 pr-3 text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 p-1 text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
