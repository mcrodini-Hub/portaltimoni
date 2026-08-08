"use client";

import { useEffect, useMemo, useState } from "react";

const TRELLO_POWER_UP_PAGE = "https://trello.com/power-ups/admin";
const ATLASSIAN_APPS_PAGE = "https://developer.atlassian.com/console/myapps/";

export default function ConfigurarTrelloClient() {
  const [key, setKey] = useState("");
  const [token, setToken] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const normalizedKey = key.trim();
  const keyLooksValid = /^[a-f0-9]{32}$/i.test(normalizedKey);
  const tokenUrl = useMemo(() => {
    if (!keyLooksValid) return "";
    const params = new URLSearchParams({
      expiration: "never",
      name: "Portal Timoni - Compras",
      scope: "read,write",
      response_type: "token",
      key: normalizedKey,
    });
    return `https://trello.com/1/authorize?${params.toString()}`;
  }, [keyLooksValid, normalizedKey]);

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
    if (!keyLooksValid) {
      setError("A API Key pública deve ter exatamente 32 caracteres. Não use o Secret.");
      return;
    }
    if (!token.trim()) {
      setError("Clique em Gerar token, autorize no Trello e cole o código exibido.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/compras/trello-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: normalizedKey, token: token.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "As credenciais não foram aceitas.");
      setConfigured(true);
      setMessage(`Trello conectado ao quadro ${payload.boardName || "Compras"}.`);
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
      setKey("");
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
        <p className="mt-3 text-sm leading-6 text-slate-600">Esta página permanece disponível mesmo quando o Trello já está conectado.</p>

        {configured ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-900">
              {message || "Trello conectado neste navegador."}
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/dashboard/compras" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white">Abrir Compras</a>
              <button type="button" onClick={() => void reconfigure()} disabled={loading} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-300 bg-white px-5 text-sm font-semibold text-blue-800 disabled:opacity-50">Reconfigurar conexão</button>
            </div>
            <article className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm font-semibold text-blue-950">Onde consultar/criar a API do Trello</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href={TRELLO_POWER_UP_PAGE} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white">Abrir Power-Ups do Trello</a>
                <a href={ATLASSIAN_APPS_PAGE} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-300 bg-white px-5 text-sm font-semibold text-blue-800">Alternativa Atlassian</a>
              </div>
            </article>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <article className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm font-semibold text-blue-950">1. Obter a API Key</p>
              <ol className="mt-2 space-y-1 text-sm leading-6 text-blue-900">
                <li>Abra a área de Power-Ups.</li>
                <li>Abra o Power-Up <strong>Portal Timoni Compras</strong>.</li>
                <li>Na seção de API/credenciais, copie somente a <strong>API Key</strong>.</li>
              </ol>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href={TRELLO_POWER_UP_PAGE} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white">Abrir Power-Ups do Trello</a>
                <a href={ATLASSIAN_APPS_PAGE} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-300 bg-white px-5 text-sm font-semibold text-blue-800">Alternativa Atlassian</a>
              </div>
            </article>

            <label className="block">
              <span className="text-sm font-semibold text-slate-900">API Key pública</span>
              <input type="password" value={key} onChange={(event) => { setKey(event.target.value.replace(/\s/g, "")); setError(""); }} placeholder="32 caracteres" autoComplete="off" className="mt-2 min-h-12 w-full rounded-xl border border-blue-200 px-4 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
            </label>

            <article className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm font-semibold text-blue-950">2. Autorizar o token</p>
              {tokenUrl ? (
                <a href={tokenUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white">Gerar token no Trello</a>
              ) : (
                <span className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-100 px-5 text-sm font-semibold text-blue-700">Cole primeiro a API Key correta</span>
              )}
            </article>

            <label className="block">
              <span className="text-sm font-semibold text-slate-900">Token autorizado</span>
              <textarea value={token} onChange={(event) => { setToken(event.target.value.replace(/\s/g, "")); setError(""); }} placeholder="Cole aqui o token mostrado pelo Trello" rows={3} autoComplete="off" className="mt-2 w-full rounded-xl border border-blue-200 px-4 py-3 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
            </label>

            <button type="button" disabled={loading || !keyLooksValid || !token.trim()} onClick={save} className="min-h-12 rounded-xl bg-blue-800 px-6 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Validando..." : "Salvar e conectar"}</button>
          </div>
        )}

        {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}
      </section>
    </div>
  );
}
