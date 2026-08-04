"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const TRELLO_KEY_PAGE = "https://trello.com/app-key";

export default function ConfigurarTrelloClient() {
  const router = useRouter();
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
        const isConfigured = Boolean(payload.configured);
        setConfigured(isConfigured);
        if (isConfigured) {
          window.setTimeout(() => router.replace("/dashboard/compras"), 500);
        }
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Falha ao verificar o Trello."),
      )
      .finally(() => setLoading(false));
  }, [router]);

  async function save() {
    setError("");
    setMessage("");

    if (!keyLooksValid) {
      setError("A chave pública do Trello deve ter 32 caracteres. Copie somente o campo API Key, não o Secret.");
      return;
    }
    if (!token.trim()) {
      setError("Gere o token no botão azul, autorize no Trello e cole o código exibido.");
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
      setMessage(`Trello conectado ao quadro ${payload.boardName || "Compras"}. Abrindo o módulo...`);
      window.setTimeout(() => router.replace("/dashboard/compras"), 900);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao conectar o Trello.");
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
          Faça esta conexão uma única vez. Depois, a configuração desaparece e Compras funciona diretamente no Portal.
        </p>

        {configured ? (
          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm font-semibold text-blue-900">
            {message || "Trello conectado. Abrindo Compras..."}
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <article className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm font-semibold text-blue-950">1. Obter a chave pública</p>
              <p className="mt-2 text-sm leading-6 text-blue-900">
                Abra a página do Trello e copie somente o valor chamado <strong>API Key</strong>. Não copie o Secret.
              </p>
              <a
                href={TRELLO_KEY_PAGE}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white hover:bg-blue-900"
              >
                Abrir página da chave
              </a>
            </article>

            <label className="block">
              <span className="text-sm font-semibold text-slate-900">Chave da API</span>
              <input
                type="password"
                value={key}
                onChange={(event) => {
                  setKey(event.target.value.replace(/\s/g, ""));
                  setError("");
                }}
                placeholder="32 caracteres"
                autoComplete="off"
                className="mt-2 min-h-12 w-full rounded-xl border border-blue-200 px-4 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
              />
              {normalizedKey && !keyLooksValid && (
                <span className="mt-2 block text-xs font-medium text-rose-700">
                  Esta não parece ser a API Key pública. Ela deve ter exatamente 32 caracteres.
                </span>
              )}
            </label>

            <article className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm font-semibold text-blue-950">2. Gerar o token autorizado</p>
              <p className="mt-2 text-sm leading-6 text-blue-900">
                Depois de colar a chave correta, clique no botão, escolha <strong>Permitir</strong> no Trello e copie o token exibido.
              </p>
              {tokenUrl ? (
                <a
                  href={tokenUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white hover:bg-blue-900"
                >
                  Gerar token no Trello
                </a>
              ) : (
                <span className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-100 px-5 text-sm font-semibold text-blue-700">
                  Cole primeiro a chave correta
                </span>
              )}
            </article>

            <label className="block">
              <span className="text-sm font-semibold text-slate-900">Token autorizado</span>
              <textarea
                value={token}
                onChange={(event) => {
                  setToken(event.target.value.replace(/\s/g, ""));
                  setError("");
                }}
                placeholder="Cole aqui o token mostrado pelo Trello"
                rows={3}
                autoComplete="off"
                className="mt-2 w-full rounded-xl border border-blue-200 px-4 py-3 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <button
              type="button"
              disabled={loading || !keyLooksValid || !token.trim()}
              onClick={save}
              className="min-h-12 rounded-xl bg-blue-800 px-6 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-blue-200 disabled:text-blue-700"
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
