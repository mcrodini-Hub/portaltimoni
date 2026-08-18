"use client";

import { useEffect, useState } from "react";

const TRELLO_API_KEY = "6d6dfd3e5a2a67b5a99006ae2825a5df";
const TRELLO_POWER_UP_PAGE = "https://trello.com/power-ups/admin";
const ATLASSIAN_APPS_PAGE = "https://developer.atlassian.com/console/myapps/";

const TRELLO_AUTHORIZE_URL =
  `https://trello.com/1/authorize?expiration=never&name=${encodeURIComponent("Portal Timoni - Compras")}` +
  `&scope=read,write&response_type=token&key=${TRELLO_API_KEY}`;

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
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Falha ao verificar o Trello."),
      )
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setError("");
    setMessage("");
    const value = token.replace(/\s/g, "");
    if (!value) {
      setError("Cole o código de autorização gerado pelo Trello.");
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
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Configuração única</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Trello — Módulo Compras
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          O Portal já possui a API Key pública. Você só precisa gerar a autorização do Trello, copiar o código exibido e colar abaixo.
        </p>

        {configured ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-900">
              {message || "Trello conectado ao Portal."}
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="/dashboard/compras"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white"
              >
                Abrir Compras
              </a>
              <button
                type="button"
                onClick={() => void reconfigure()}
                disabled={loading}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-300 bg-white px-5 text-sm font-semibold text-blue-800 disabled:opacity-50"
              >
                Trocar chave
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-950">Gerar a chave do Trello</p>
              <ol className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
                <li>1. Clique em “Gerar chave do Trello”.</li>
                <li>2. No Trello, clique em “Permitir”.</li>
                <li>3. Copie o código longo exibido, normalmente iniciado por ATTA.</li>
                <li>4. Volte ao Portal, cole no campo abaixo e salve.</li>
              </ol>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={TRELLO_AUTHORIZE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white hover:bg-blue-900"
                >
                  Gerar chave do Trello
                </a>
                <a
                  href={TRELLO_POWER_UP_PAGE}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-300 bg-white px-5 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                >
                  Abrir área da API do Trello
                </a>
              </div>
              <a
                href={ATLASSIAN_APPS_PAGE}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-xs font-semibold text-blue-800 hover:underline"
              >
                Alternativa: abrir aplicativos da Atlassian →
              </a>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-slate-900">Código de autorização do Trello</span>
              <textarea
                value={token}
                onChange={(event) => {
                  setToken(event.target.value.replace(/\s/g, ""));
                  setError("");
                }}
                placeholder="Cole aqui o código que começa com ATTA..."
                rows={3}
                autoComplete="off"
                className="mt-2 w-full rounded-xl border border-blue-200 px-4 py-3 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <button
              type="button"
              disabled={loading || !token.trim()}
              onClick={save}
              className="min-h-12 rounded-xl bg-blue-800 px-6 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Validando..." : "Salvar e conectar"}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
