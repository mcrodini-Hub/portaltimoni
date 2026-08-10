"use client";

import { useEffect, useState } from "react";

export default function ConfigurarTrelloClient() {
  const [token, setToken] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/compras/trello-config", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Falha ao verificar o Trello.");
        setConfigured(Boolean(payload.configured));
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Falha ao verificar o Trello."))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setError("");
    setMessage("");
    const value = token.replace(/\s/g, "");
    if (!value) {
      setError("Cole a chave de conexão do Trello.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/compras/trello-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "A chave não foi aceita.");
      setConfigured(true);
      setMessage(`Trello conectado ao quadro ${payload.boardName || "Compras"}.`);
      setToken("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao conectar o Trello.");
    } finally {
      setLoading(false);
    }
  }

  async function reconfigure() {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/compras/trello-config", { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Não foi possível liberar a reconfiguração.");
      setConfigured(false);
      setToken("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao liberar a reconfiguração.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <section className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Configuração do Trello</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Trello — Módulo Compras</h1>

        {configured ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-900">
              {message || "Trello conectado neste navegador."}
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/dashboard/compras" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white">Abrir Compras</a>
              <button type="button" onClick={() => void reconfigure()} disabled={loading} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-300 bg-white px-5 text-sm font-semibold text-blue-800 disabled:opacity-50">Trocar chave</button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-950">
              Cole abaixo somente o código longo de autorização do Trello, normalmente iniciado por <strong>ATTA</strong>.
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-slate-900">Chave do Trello</span>
              <textarea
                value={token}
                onChange={(event) => {
                  setToken(event.target.value.replace(/\s/g, ""));
                  setError("");
                }}
                placeholder="Cole aqui a chave do Trello"
                rows={3}
                autoComplete="off"
                className="mt-2 w-full rounded-xl border border-blue-200 px-4 py-3 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <button type="button" disabled={loading || !token.trim()} onClick={save} className="min-h-12 rounded-xl bg-blue-800 px-6 text-sm font-semibold text-white disabled:opacity-50">
              {loading ? "Validando..." : "Salvar e conectar"}
            </button>
          </div>
        )}

        {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}
      </section>
    </div>
  );
}
