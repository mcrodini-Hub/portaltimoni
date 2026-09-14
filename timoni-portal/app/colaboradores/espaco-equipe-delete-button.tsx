"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function EspacoEquipeDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!window.confirm("Excluir esta mensagem do Espaço Equipe?")) return;

    setDeleting(true);
    setError("");

    try {
      const response = await fetch("/api/espaco-equipe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível excluir a mensagem.");
      }

      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir a mensagem.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {deleting ? "Excluindo..." : "Excluir"}
      </button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
