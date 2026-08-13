"use client";

import { useEffect, useMemo, useState } from "react";

type PanelStore = "geral" | "rio claro" | "araras";
type Comunicado = {
  id: string;
  createdAt: string;
  unit: "geral" | "araras" | "rio claro";
  title: string;
  message: string;
  status: "ativo" | "arquivado";
  updatedAt: string;
  startsAt: string;
  expiresAt: string;
};

function label(unit: Comunicado["unit"]) {
  if (unit === "araras") return "Araras";
  if (unit === "rio claro") return "Rio Claro";
  return "Geral";
}

function formatDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default function ComunicadosFeed({ store }: { store: PanelStore }) {
  const [items, setItems] = useState<Comunicado[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/comunicados", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) return [];
        return (data.items || []) as Comunicado[];
      })
      .then((data) => {
        if (active) setItems(data);
      })
      .catch(() => {
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === "ativo" &&
          (!item.startsAt || Date.parse(item.startsAt) <= Date.now()) &&
          (!item.expiresAt || Date.parse(item.expiresAt) >= Date.now()) &&
          (store === "geral" || item.unit === "geral" || item.unit === store),
      ),
    [items, store],
  );

  if (!visible.length) return null;

  return (
    <section className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {visible.map((item) => (
        <article
          key={item.id}
          className={`rounded-3xl border p-6 shadow-sm ${
            item.unit === "geral"
              ? "border-orange-200 bg-orange-50 md:col-span-2 xl:col-span-4"
              : "border-blue-200 bg-blue-50 md:col-span-2"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider ${item.unit === "geral" ? "text-orange-700" : "text-blue-700"}`}>
                Comunicado {label(item.unit)}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">{item.title}</h2>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
              {formatDate(item.createdAt)}
            </span>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.message}</p>
        </article>
      ))}
    </section>
  );
}
