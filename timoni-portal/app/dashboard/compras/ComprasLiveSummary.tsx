"use client";

import { useCallback, useEffect, useState } from "react";

const CHANNEL = "PORTAL_TIMONI_COMPRAS";

type ComprasResumo = {
  paraFazer: number;
  urgentes: number;
  enviadosRioClaro: number;
  enviadosAraras: number;
  atualizadoEm?: string | null;
};

type Props = {
  initialResumo?: ComprasResumo | null;
};

function normalizeResumo(value: unknown): ComprasResumo | null {
  if (!value || typeof value !== "object") return null;
  const resumo = value as Record<string, unknown>;

  return {
    paraFazer: Number(resumo.paraFazer) || 0,
    urgentes: Number(resumo.urgentes) || 0,
    enviadosRioClaro: Number(resumo.enviadosRioClaro) || 0,
    enviadosAraras: Number(resumo.enviadosAraras) || 0,
    atualizadoEm:
      typeof resumo.atualizadoEm === "string" ? resumo.atualizadoEm : null,
  };
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return null;

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

export default function ComprasLiveSummary({ initialResumo = null }: Props) {
  const [resumo, setResumo] = useState<ComprasResumo | null>(initialResumo);
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [version, setVersion] = useState<string | null>(null);

  const requestStatus = useCallback(() => {
    setChecking(true);
    window.postMessage(
      { channel: CHANNEL, type: "GET_STATUS" },
      window.location.origin,
    );
  }, []);

  useEffect(() => {
    function receiveMessage(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.channel !== CHANNEL) return;
      if (event.data.type !== "READY" && event.data.type !== "STATUS") return;

      setConnected(true);
      setChecking(false);
      setVersion(event.data.version || null);

      const nextResumo = normalizeResumo(event.data.resumo);
      if (nextResumo) setResumo(nextResumo);
    }

    window.addEventListener("message", receiveMessage);
    requestStatus();

    const retryTimers = [400, 1000, 2200].map((delay) =>
      window.setTimeout(requestStatus, delay),
    );
    const finishTimer = window.setTimeout(() => setChecking(false), 3500);

    function handleFocus() {
      requestStatus();
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.removeEventListener("message", receiveMessage);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
      retryTimers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(finishTimer);
    };
  }, [requestStatus]);

  const cards = [
    ["Pedidos para fazer", resumo?.paraFazer],
    ["Urgentes", resumo?.urgentes],
    ["Enviados — Rio Claro", resumo?.enviadosRioClaro],
    ["Enviados — Araras", resumo?.enviadosAraras],
  ] as const;

  const updatedAt = formatUpdatedAt(resumo?.atualizadoEm);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${
            connected
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {connected
            ? `Extensão conectada${version ? ` — v${version}` : ""}`
            : checking
              ? "Conectando à extensão..."
              : "Extensão não detectada"}
        </span>

        {!connected && !checking && (
          <button
            type="button"
            onClick={requestStatus}
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-100"
          >
            Reconectar extensão
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <article
            key={label}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
          >
            <p className="text-3xl font-semibold tracking-tight text-slate-950">
              {value ?? "—"}
            </p>
            <p className="mt-2 text-sm leading-5 text-slate-600">{label}</p>
          </article>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {updatedAt
          ? `Última leitura do Trello: ${updatedAt}`
          : connected
            ? "Abra ou atualize a relação de pedidos na extensão para preencher os totais."
            : "O Portal receberá os totais assim que reconhecer a extensão instalada."}
      </p>
    </div>
  );
}
