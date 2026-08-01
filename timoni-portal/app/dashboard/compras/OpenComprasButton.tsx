"use client";

import { useEffect, useRef, useState } from "react";

const CHANNEL = "PORTAL_TIMONI_COMPRAS";

type BridgeStatus =
  | "checking"
  | "ready"
  | "opening"
  | "opened"
  | "missing"
  | "error";

export default function OpenComprasButton() {
  const [status, setStatus] = useState<BridgeStatus>("checking");
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function receiveMessage(event: MessageEvent) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.channel !== CHANNEL) return;

      if (event.data.type === "READY") {
        setVersion(event.data.version || null);
        setError(null);
        setStatus((current) => (current === "opening" ? current : "ready"));
        return;
      }

      if (event.data.type !== "OPEN_RESULT") return;

      if (openingTimer.current) {
        clearTimeout(openingTimer.current);
        openingTimer.current = null;
      }

      if (event.data.success) {
        setError(null);
        setStatus("opened");
        window.setTimeout(() => setStatus("ready"), 1400);
      } else {
        setError(event.data.error || "Não foi possível abrir o módulo Compras.");
        setStatus("error");
      }
    }

    window.addEventListener("message", receiveMessage);
    window.postMessage({ channel: CHANNEL, type: "PING" }, window.location.origin);

    const detectionTimer = window.setTimeout(() => {
      setStatus((current) => (current === "checking" ? "missing" : current));
    }, 1500);

    return () => {
      window.removeEventListener("message", receiveMessage);
      window.clearTimeout(detectionTimer);
      if (openingTimer.current) clearTimeout(openingTimer.current);
    };
  }, []);

  function openCompras() {
    setError(null);
    setStatus("opening");
    window.postMessage({ channel: CHANNEL, type: "OPEN" }, window.location.origin);

    openingTimer.current = window.setTimeout(() => {
      setError("A extensão não respondeu. Recarregue a extensão e esta página.");
      setStatus("error");
    }, 2500);
  }

  const disabled = status === "checking" || status === "opening" || status === "missing";
  const label =
    status === "checking"
      ? "Verificando módulo..."
      : status === "opening"
        ? "Abrindo módulo..."
        : status === "opened"
          ? "Módulo aberto"
          : "Abrir módulo Compras";

  return (
    <div>
      <button
        type="button"
        onClick={openCompras}
        disabled={disabled}
        className="w-full rounded-xl bg-blue-700 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
      >
        {label}
      </button>

      <div className="mt-3 text-sm">
        {status === "ready" && (
          <p className="text-emerald-700">
            Extensão instalada{version ? ` — versão ${version}` : ""}.
          </p>
        )}
        {status === "missing" && (
          <p className="text-amber-700">
            Módulo não detectado. Atualize ou recarregue a extensão Compras e depois atualize esta página.
          </p>
        )}
        {status === "error" && <p className="text-rose-700">{error}</p>}
      </div>
    </div>
  );
}
