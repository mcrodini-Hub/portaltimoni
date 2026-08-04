"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ConfigurarTrelloClient() {
  const [key, setKey] = useState("");
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
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Falha ao verificar o Trello."),
      )
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setError("");
    setMessage("");
    if (!key.trim() || !token.trim()) {
      setError("Informe a chave e o token do Trello.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/compras/trello-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim(), token: token.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "As credenciais não foram aceitas.");
      setConfigured(true);
      setKey("");
      setToken("");
      setMessage(`Trello conectado ao quadro ${payload.boardName || "Compras"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao conectar o Trello.");
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/compras/trello-config", { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Não foi possível desconectar.");
      setConfigured(false);
      setMessage("Credenciais removidas deste navegador.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível desconectar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <section className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
          Configuração única
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Trello — Módulo Compras
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Use a chave e o token da API do Trello vinculados à conta que acessa o quadro Compras.
          Eles ficam em cookies seguros, inacessíveis ao código da página.
        </p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          No Trello, abra a área de desenvolvedor da sua conta, gere uma chave de API e autorize
          um token com leitura e escrita no quadro Compras. Essa etapa é feita uma única vez neste navegador.
        </div>

        {configured && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Trello conectado neste navegador.
          </div>
        )}

        {!configured && !loading && (
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-900">Chave da API</span>
              <input
                type="password"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                autoComplete="off"
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-600"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-900">Token autorizado</span>
              <input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                autoComplete="off"
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-600"
              />
            </label>
            <button
              type="button"
              disabled={loading || !key.trim() || !token.trim()}
              onClick={save}
              className="min-h-12 rounded-xl bg-blue-800 px-6 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? "Validando..." : "Salvar e conectar"}
            </button>
          </div>
        )}

        {configured && (
          <button
            type="button"
            disabled={loading}
            onClick={disconnect}
            className="mt-5 min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
          >
            Remover conexão deste navegador
          </button>
        )}

        {message && (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {error}
          </p>
        )}

        <div className="mt-6 border-t border-slate-200 pt-5">
          <Link href="/dashboard/compras" className="text-sm font-semibold text-blue-800 hover:underline">
            Voltar para Compras →
          </Link>
        </div>
      </section>
    </div>
  );
}
