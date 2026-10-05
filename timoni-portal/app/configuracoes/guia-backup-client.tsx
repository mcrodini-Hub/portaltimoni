"use client";

import { useRef, useState } from "react";

const GUIDE = [
  { name: "Painel", steps: ["Abra o Painel.", "Leia os avisos e os cards liberados para seu acesso.", "Entre no módulo desejado pelo card ou cabeçalho."] },
  { name: "Agenda Ciça", steps: ["Abra Agenda Ciça.", "Consulte dia, semana ou mês.", "Abra o compromisso para visualizar ou editar quando permitido."] },
  { name: "Agenda CT", steps: ["Abra Agenda CT.", "Consulte os compromissos da Casa Timoni.", "Use dia, semana ou mês para localizar o evento."] },
  { name: "Chat", steps: ["Abra o Chat.", "Selecione o colaborador.", "Envie a mensagem e acompanhe as não lidas."] },
  { name: "Compras", steps: ["Abra Compras.", "Consulte ou atualize a demanda/pedido.", "Use Atualizar Trello quando necessário e acompanhe o andamento."] },
  { name: "Conferência", steps: ["Abra Conferência.", "Envie os documentos solicitados.", "Revise as divergências apresentadas antes de concluir."] },
  { name: "Estoque", steps: ["Abra Estoque.", "Consulte pedidos e solicitações da unidade.", "Use Consultar e solicitar produto para uma nova demanda."] },
  { name: "Rotativo", steps: ["Abra Rotativo.", "Realize a atualização do estoque.", "Ao concluir, use Rotativo atualizado para abrir somente os itens daquela execução."] },
  { name: "Motorista", steps: ["Abra Motorista.", "Consulte as rotas e entregas.", "Atualize somente os campos disponíveis para seu acesso."] },
  { name: "Reuniões", steps: ["Abra Reuniões.", "Consulte PRÓXIMA e SEGUINTE.", "Edite, salve ou arquive manualmente quando necessário."] },
  { name: "Leads", steps: ["Abra Leads.", "Consulte Follow Up e A Prospectar.", "Atualize Status ou use Reativar conforme a próxima ação."] },
  { name: "OS — Ordem de Serviço", steps: ["Abra OS.", "Selecione o tipo de serviço.", "Preencha os campos e anexe print ou foto quando solicitado."] },
  { name: "Configurações", steps: ["Abra Configurações.", "Localize o colaborador ou acesso.", "Edite somente permissões necessárias e clique em Salvar."] },
];

export default function GuiaBackupClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"backup" | "restore" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function downloadBackup() {
    setBusy("backup");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/configuracoes/backup", { cache: "no-store" });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Não foi possível gerar o backup.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="?([^\"]+)"?/i);
      const filename = match?.[1] || `portal-timoni-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage("Backup gerado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o backup.");
    } finally {
      setBusy("");
    }
  }

  async function restoreBackup(file: File) {
    if (!window.confirm("Recuperar este backup? Os dados incluídos no arquivo substituirão os dados atuais correspondentes.")) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy("restore");
    setMessage("");
    setError("");
    try {
      const formData = new FormData();
      formData.append("backup", file);
      const response = await fetch("/api/configuracoes/backup", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível recuperar o backup.");
      setMessage("Backup recuperado. Atualize a página para carregar os dados restaurados.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível recuperar o backup.");
    } finally {
      setBusy("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <section id="backup" className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Backup</h2>
            <p className="mt-0.5 text-xs text-slate-600">Gerar ou recuperar o backup do Portal Timoni.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => void downloadBackup()} disabled={Boolean(busy)} className="min-h-10 rounded-xl bg-[#13038D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy === "backup" ? "Gerando..." : "Backup"}
            </button>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={Boolean(busy)} className="min-h-10 rounded-xl border border-[#13038D] bg-white px-4 py-2 text-sm font-semibold text-[#13038D] disabled:opacity-50">
              {busy === "restore" ? "Recuperando..." : "Recuperar backup"}
            </button>
            <input ref={inputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void restoreBackup(file); }} />
          </div>
        </div>
        {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">{message}</p>}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
      </section>

      <section id="guia" className="scroll-mt-24 mb-5 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-slate-950">Guia de uso</h2>
          <p className="mt-0.5 text-xs text-slate-600">Etapas essenciais de cada módulo.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDE.map((module) => (
            <article key={module.name} className="rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-[#13038D]">{module.name}</h3>
              <ol className="mt-2 space-y-1 text-xs leading-5 text-slate-700">
                {module.steps.map((step, index) => <li key={step}><span className="font-semibold">{index + 1}.</span> {step}</li>)}
              </ol>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
