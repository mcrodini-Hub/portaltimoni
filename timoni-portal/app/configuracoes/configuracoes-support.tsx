"use client";

import { useRef, useState } from "react";

const GUIDE = [
  {
    title: "Painel / Avisos",
    steps: [
      "Abra o Painel e acompanhe os boxes disponíveis para o seu acesso.",
      "Toque no box desejado para entrar no módulo correspondente.",
      "Em Avisos, consulte os comunicados e registre a leitura quando solicitado.",
    ],
  },
  {
    title: "Compras",
    steps: [
      "Abra Pedidos pendentes e selecione o pedido.",
      "Revise itens, fornecedor, unidade e informações do Trello.",
      "Confirme o pedido e finalize; depois acompanhe em Pedidos enviados.",
    ],
  },
  {
    title: "Motorista",
    steps: [
      "Abra Motorista para consultar a programação do dia.",
      "Cadastre ou ajuste viagens e bloqueios quando necessário.",
      "Use a visualização operacional para acompanhar as rotas.",
    ],
  },
  {
    title: "Agenda Ciça",
    steps: [
      "Abra a agenda e escolha Dia, Semana ou Mês.",
      "Consulte os compromissos e use a busca quando necessário.",
      "Conclua o compromisso quando ele não precisar mais aparecer na lista do Painel.",
    ],
  },
  {
    title: "Agenda CT",
    steps: [
      "Abra a Agenda CT para consultar somente os compromissos da Casa Timoni.",
      "Use as visualizações Dia, Semana ou Mês.",
      "Mantenha a agenda pessoal separada da Agenda CT.",
    ],
  },
  {
    title: "Leads",
    steps: [
      "Abra Leads e consulte a lista da unidade correspondente.",
      "Atualize o status e a próxima ação conforme o andamento do contato.",
      "Use Reativar quando um lead de A Prospectar precisar voltar ao Follow Up.",
    ],
  },
  {
    title: "Estoque",
    steps: [
      "Abra Estoque para consultar pedidos e solicitações da unidade.",
      "Use Consultar e solicitar produto quando precisar falar com o estoque.",
      "Acompanhe a situação do pedido até a conclusão.",
    ],
  },
  {
    title: "Rotativo",
    steps: [
      "Abra Rotativo e execute a atualização do estoque conforme o fluxo do módulo.",
      "Finalize a atualização sem alterar as regras já aprovadas da planilha.",
      "Depois, use Rotativo atualizado para abrir somente os itens daquela execução.",
    ],
  },
  {
    title: "Conferência",
    steps: [
      "Envie juntos os documentos necessários para a conferência.",
      "Execute a análise e revise as divergências encontradas.",
      "Baixe a planilha final mantendo o modelo aprovado.",
    ],
  },
  {
    title: "Reuniões",
    steps: [
      "Consulte Próxima e Seguinte no box de próximas reuniões.",
      "Abra a reunião para editar, salvar novamente ou consultar o histórico.",
      "Arquive ou desarquive somente de forma manual.",
    ],
  },
  {
    title: "OS — Ordem de Serviço",
    steps: [
      "Abra OS e selecione o tipo de serviço.",
      "Preencha os campos do fluxo correspondente e anexe print ou foto quando necessário.",
      "Salve e acompanhe a OS até a conclusão.",
    ],
  },
  {
    title: "Equipe",
    steps: [
      "Abra Equipe para consultar as mensagens internas.",
      "Leia as informações destinadas à sua unidade ou acesso.",
      "Use o módulo somente para comunicação interna da equipe.",
    ],
  },
  {
    title: "Chat",
    steps: [
      "Abra o Chat e selecione o colaborador.",
      "Envie e acompanhe mensagens 1:1; mensagens não lidas aparecem com indicador.",
      "Edite ou exclua apenas as suas próprias mensagens quando necessário.",
    ],
  },
  {
    title: "Configurações",
    steps: [
      "Cadastre ou edite colaboradores e vincule o e-mail de acesso.",
      "Defina os módulos permitidos e o que deve aparecer no mobile.",
      "Use Backup para salvar uma cópia e Recuperar backup somente quando precisar restaurar o Portal.",
    ],
  },
];

export default function ConfiguracoesSupport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"" | "backup" | "restore">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function downloadBackup() {
    setBusy("backup");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/configuracoes/backup", { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível gerar o backup.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
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

  async function restoreBackup(file?: File) {
    if (!file) return;
    if (!window.confirm("Recuperar este backup? Os dados atuais do Portal serão substituídos pelos dados do arquivo selecionado.")) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy("restore");
    setMessage("");
    setError("");
    try {
      const form = new FormData();
      form.append("backup", file);
      const response = await fetch("/api/configuracoes/backup", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível recuperar o backup.");
      setMessage("Backup recuperado. Atualize a página para visualizar os dados restaurados.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível recuperar o backup.");
    } finally {
      setBusy("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-6 grid gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#13038D]">Segurança</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Backup</h2>
            <p className="mt-1 text-xs text-slate-500">Salvar ou recuperar uma cópia das configurações e dados internos do Portal.</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <button type="button" onClick={() => void downloadBackup()} disabled={Boolean(busy)} className="flex-1 rounded-lg bg-[#13038D] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:flex-none">
              {busy === "backup" ? "Gerando..." : "Backup"}
            </button>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={Boolean(busy)} className="flex-1 rounded-lg border border-[#13038D] px-4 py-2 text-sm font-semibold text-[#13038D] disabled:opacity-50 sm:flex-none">
              {busy === "restore" ? "Recuperando..." : "Recuperar backup"}
            </button>
            <input ref={inputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(event) => void restoreBackup(event.target.files?.[0])} />
          </div>
        </div>
        {message ? <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">{message}</p> : null}
        {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p> : null}
      </section>

      <section id="guia" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#13038D]">Referência rápida</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Guia de uso</h2>
          <p className="mt-1 text-xs text-slate-500">Abra somente o módulo que deseja consultar.</p>
        </div>

        <div className="grid gap-2">
          {GUIDE.map((module) => (
            <details key={module.title} className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                <span>{module.title}</span>
                <span className="text-lg leading-none text-[#13038D] group-open:hidden">+</span>
                <span className="hidden text-lg leading-none text-[#13038D] group-open:inline">−</span>
              </summary>
              <div className="border-t border-slate-100 px-4 py-3">
                <ol className="grid gap-2 text-sm text-slate-700">
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
    </div>
  );
}
