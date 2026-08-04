"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ConfigurarGeminiClient() {
  const [apiKey, setApiKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [source, setSource] = useState<"server" | "browser" | "none">("none");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/configurar-gemini", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Falha ao verificar o Gemini.");
        setConfigured(Boolean(payload.configured));
        setSource(payload.source || "none");
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Falha ao verificar o Gemini."),
      )
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setError("");
    setMessage("");
    if (!apiKey.trim()) {
      setError("Cole a chave criada no Google AI Studio.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/configurar-gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "A chave não foi aceita.");

      setConfigured(true);
      setSource("browser");
      setApiKey("");
      setMessage("Gemini configurado. A Conferência de Preços está liberada neste navegador.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao salvar a chave.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <section className="rounded-3xl border border-cyan-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-800">
          Configuração única
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Gemini — Conferência de Preços
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          A chave é validada pelo Google e salva como cookie seguro e inacessível ao JavaScript.
          Depois disso, a conferência funciona normalmente neste navegador.
        </p>

        {configured && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Gemini configurado {source === "server" ? "no servidor" : "neste navegador"}.
          </div>
        )}

        {!configured && !loading && (
          <>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Criar a chave</p>
              <ol className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
                <li>1. Abra o Google AI Studio.</li>
                <li>2. Clique em “Create API key”.</li>
                <li>3. Copie a chave e cole abaixo.</li>
              </ol>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Abrir Google AI Studio
              </a>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-slate-900">Chave do Gemini</span>
              <input
                type="password"
                value={apiKey}
                disabled={loading}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Cole a chave que começa com AIza..."
                autoComplete="off"
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900 outline-none focus:border-cyan-600 disabled:bg-slate-100"
              />
            </label>

            <button
              type="button"
              disabled={loading || !apiKey.trim()}
              onClick={save}
              className="mt-4 min-h-12 rounded-xl bg-cyan-700 px-6 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? "Validando..." : "Salvar e liberar módulo"}
            </button>
          </>
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
          <Link
            href="/dashboard/conferencia-pedidos"
            className="text-sm font-semibold text-blue-800 hover:underline"
          >
            Voltar para Conferência de Preços →
          </Link>
        </div>
      </section>
    </div>
  );
}
