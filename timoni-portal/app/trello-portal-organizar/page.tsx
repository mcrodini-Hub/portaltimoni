"use client";

import { useEffect, useState } from "react";

type Result = {
  board?: string;
  created?: string[];
  updated?: string[];
  missingLists?: string[];
  error?: string;
};

export default function TrelloPortalOrganizarPage() {
  const [status, setStatus] = useState("Organizando o Trello Portal Timoni...");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const response = await fetch("/api/admin/portal-trello", { method: "POST" });
        const data = (await response.json()) as Result;
        if (cancelled) return;
        setResult(data);
        setStatus(response.ok ? "Organização concluída." : "Não foi possível concluir a organização.");
      } catch {
        if (cancelled) return;
        setStatus("Não foi possível concluir a organização.");
        setResult({ error: "Falha de conexão com o Portal." });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ maxWidth: 880, margin: "48px auto", padding: "0 24px", fontFamily: "Arial, sans-serif" }}>
      <h1>Portal Timoni — Organização do Trello</h1>
      <p>{status}</p>

      {result?.error ? (
        <div style={{ marginTop: 24, padding: 16, border: "1px solid #ccc", borderRadius: 10 }}>
          <strong>Erro:</strong> {result.error}
          {result.error.includes("Trello ainda não configurado") ? (
            <p>Abra primeiro o módulo Compras neste mesmo navegador para confirmar a conexão com o Trello e depois volte a esta página.</p>
          ) : null}
        </div>
      ) : null}

      {result && !result.error ? (
        <div style={{ marginTop: 24 }}>
          <p><strong>Quadro:</strong> {result.board}</p>
          <p><strong>Cards criados:</strong> {result.created?.length ?? 0}</p>
          <p><strong>Cards atualizados:</strong> {result.updated?.length ?? 0}</p>

          {(result.missingLists?.length ?? 0) > 0 ? (
            <div style={{ marginTop: 24, padding: 16, border: "1px solid #ccc", borderRadius: 10 }}>
              <strong>Listas não encontradas:</strong>
              <ul>
                {result.missingLists?.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : (
            <p><strong>Todas as listas previstas foram localizadas.</strong></p>
          )}
        </div>
      ) : null}
    </main>
  );
}
