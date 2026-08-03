"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ConfigurarGeminiClient() {
  const [apiKey, setApiKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/configurar-gemini", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setConfigured(Boolean(payload.configured)))
      .catch(() => setError("Não foi possível verificar a configuração atual."))
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
      if (!response.ok) {
        throw new Error(payload?.error || "A chave não foi aceita.");
      }
      setConfigured(true);
      setApiKey("");
      setMessage("Chave validada. A Conferência de Preços está liberada neste navegador.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao salvar a chave.");
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/configurar-gemini", { method: "DELETE" });
      if (!response.ok) throw new Error("Não foi possível remover a chave.");
      setConfigured(false);
      setMessage("Chave removida deste navegador.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao remover a chave.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          Alternativa sem cobrança da Vercel
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Configurar análise gratuita
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          O módulo usará a cota gratuita do Google AI Studio. Sem faturamento ativado no Google,
          a análise simplesmente para quando a cota gratuita for atingida; não há cobrança automática.
        </p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Como liberar</p>
          <ol className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
            <li>1. Abra o Google AI Studio pelo botão abaixo.</li>
            <li>2. Clique em “Create API key”.</li>
            <li>3. Copie a chave e cole neste campo.</li>
          </ol>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Abrir Google AI Studio
          </a>
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-semibold text-slate-900">Chave do Google AI Studio</span>
          <input
            type="password"
            value={apiKey}
            disabled={loading}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Cole a chave que começa com AIza..."
            autoComplete="off"
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm text-slate-900 outline-none focus:border-emerald-600 disabled:bg-slate-100"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading || !apiKey.trim()}
            onClick={save}
            className="min-h-12 rounded-xl bg-cyan-700 px-6 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? "Validando..." : "Salvar e liberar módulo"}
          </button>
          {configured && (
            <button
              type="button"
              disabled={loading}
              onClick={remove}
              className="min-h-12 rounded-xl border border-rose-300 bg-white px-5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              Remover chave
            </button>
          )}
        </div>

        {configured && !message && (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Configuração ativa neste navegador.
          </p>
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
