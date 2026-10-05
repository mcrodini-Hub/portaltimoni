"use client";

import { useRef, useState } from "react";

const GUIDE = [
  { name: "Painel / Avisos", steps: ["Abra o Painel e acompanhe os boxes disponíveis para o seu acesso.", "Entre no módulo desejado pelo box ou pelo cabeçalho.", "Em Avisos, consulte os comunicados e registre a leitura quando solicitado."] },
  { name: "Compras", steps: ["Abra Pedidos pendentes e selecione o pedido.", "Revise itens, fornecedor, unidade e informações do Trello.", "Confirme e finalize; depois acompanhe em Pedidos enviados."] },
  { name: "Motorista", steps: ["Abra Motorista para consultar a programação do dia.", "Cadastre ou ajuste viagens e bloqueios quando necessário.", "Acompanhe as rotas pela visualização operacional."] },
  { name: "Agenda Ciça", steps: ["Abra a Agenda Ciça.", "Escolha Dia, Semana ou Mês e localize o compromisso.", "Abra o compromisso para consultar, editar ou concluir quando permitido."] },
  { name: "Agenda CT", steps: ["Abra a Agenda CT.", "Consulte somente os compromissos da Casa Timoni.", "Use Dia, Semana ou Mês; a agenda pessoal permanece separada."] },
  { name: "Leads", steps: ["Abra Leads e consulte a unidade correspondente.", "Atualize Status e próxima ação conforme o andamento.", "Use Reativar quando um lead de A Prospectar precisar voltar ao Follow Up."] },
  { name: "Estoque", steps: ["Abra Estoque e consulte pedidos e solicitações da unidade.", "Use Consultar e solicitar produto para uma nova demanda.", "Acompanhe a situação até a conclusão."] },
  { name: "Rotativo", steps: ["Abra Rotativo e realize a atualização do estoque.", "Finalize mantendo as regras aprovadas da planilha.", "Use Rotativo atualizado para abrir somente os itens daquela execução."] },
  { name: "Conferência", steps: ["Envie juntos os documentos necessários.", "Execute a conferência e revise as divergências.", "Baixe a planilha final mantendo o modelo aprovado."] },
  { name: "Reuniões", steps: ["Consulte PRÓXIMA e SEGUINTE.", "Abra a reunião para editar, salvar novamente ou consultar o histórico.", "Arquive ou desarquive somente de forma manual."] },
  { name: "OS — Ordem de Serviço", steps: ["Abra OS e selecione o tipo de serviço.", "Preencha os campos do fluxo correspondente e anexe print ou foto quando necessário.", "Salve e acompanhe a OS até a conclusão."] },
  { name: "Equipe", steps: ["Abra Equipe para consultar as mensagens internas.", "Leia as informações destinadas à sua unidade ou acesso.", "Use o módulo somente para comunicação interna da equipe."] },
  { name: "Chat", steps: ["Abra o Chat e selecione o colaborador.", "Envie e acompanhe mensagens 1:1; as não lidas aparecem com indicador.", "Edite ou exclua apenas as suas próprias mensagens quando necessário."] },
  { name: "Configurações", steps: ["Cadastre ou edite colaboradores e vincule o e-mail de acesso.", "Defina os módulos permitidos e o que deve aparecer no mobile.", "Use Backup para salvar uma cópia e Recuperar backup somente quando precisar restaurar o Portal."] },
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
          <p className="mt-0.5 text-xs text-slate-600">Abra somente o módulo que deseja consultar.</p>
        </div>
        <div className="grid gap-2">
          {GUIDE.map((module) => (
            <details key={module.name} className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                <span>{module.name}</span>
                <span className="text-lg leading-none text-[#13038D] group-open:hidden">+</span>
                <span className="hidden text-lg leading-none text-[#13038D] group-open:inline">−</span>
              </summary>
              <div className="border-t border-slate-100 px-4 py-3">
                <ol className="grid gap-2 text-xs leading-5 text-slate-700 sm:text-sm">
                  {module.steps.map((step, index) => (
                    <li key={step} className="flex gap-2">
                      <span className="font-semibold text-[#13038D]">{index + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
