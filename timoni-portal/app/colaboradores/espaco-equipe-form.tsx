"use client";

import { FormEvent, useState } from "react";

export default function EspacoEquipeForm() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");

    if (!message.trim()) {
      setStatus("error");
      setFeedback("Escreva a mensagem antes de registrar.");
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch("/api/espaco-equipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível registrar.");
      }

      setStatus("success");
      setFeedback("Mensagem registrada. Obrigada pela contribuição.");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setFeedback(error instanceof Error ? error.message : "Não foi possível registrar.");
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Espaço Equipe</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">Sua contribuição ajuda a melhorar nosso dia a dia</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use este espaço para enviar sugestões, reclamações, dificuldades ou ideias de melhoria.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Mensagem</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            maxLength={2500}
            placeholder="Escreva sua sugestão, reclamação ou ideia..."
            className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            required
          />
        </label>

        <button
          type="submit"
          disabled={status === "saving"}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-800 px-6 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "saving" ? "Registrando..." : "Registrar"}
        </button>
      </form>

      {feedback && (
        <p className={`mt-3 text-sm font-medium ${status === "success" ? "text-emerald-700" : "text-rose-700"}`}>
          {feedback}
        </p>
      )}
    </section>
  );
}
