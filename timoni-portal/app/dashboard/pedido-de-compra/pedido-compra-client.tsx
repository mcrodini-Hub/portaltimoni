"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RequestUnit = "rio_claro" | "araras";
type SentOrder = { id: string; nome: string; enviadoEm: string; previsaoEntrega: string; unidade: RequestUnit };
function unitLabel(unit: RequestUnit) { return unit === "araras" ? "Araras" : "Rio Claro"; }
function dateOnly(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(d);
}


export default function PedidoCompraClient({ visibleUnits }: { visibleUnits: RequestUnit[] }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sentOrders, setSentOrders] = useState<SentOrder[]>([]);
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/pedido-de-compra", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Falha ao carregar");
      setSentOrders(payload.pedidosEnviados);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar");
    } finally { inFlight.current = false; setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 60000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);
  function SentOrdersSection() {

    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Acompanhamento</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Pedidos enviados</h2>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50"
          >
            Atualizar lista
          </button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {visibleUnits.map((currentUnit) => {
            const orders = sentOrders.filter((order) => order.unidade === currentUnit);
            return (
              <div key={currentUnit} className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                  <h3 className="font-semibold text-slate-950">{unitLabel(currentUnit)}</h3>
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">{orders.length}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <article key={order.id} className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{order.nome}</p>
                      <p className="mt-1 text-sm text-slate-500">Enviado: {dateOnly(order.enviadoEm)} · Entrega: {dateOnly(order.previsaoEntrega)}</p>
                    </article>
                  ))}
                  {!loading && !orders.length && <p className="px-4 py-5 text-sm text-slate-500">Nenhum pedido enviado.</p>}
                  {loading && <p className="px-4 py-5 text-sm text-slate-500">Atualizando...</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return <div className="pb-10 space-y-5">{error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{error}</p>}{SentOrdersSection()}</div>;
}
