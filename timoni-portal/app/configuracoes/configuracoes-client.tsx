"use client";

import { ChangeEvent, useEffect, useState } from "react";
import type { PortalModule, PortalUser } from "@/lib/access-control";
import type { ConfiguredCollaborator, PortalAuditEntry } from "@/lib/portal-config";

type Tab = "acessos" | "colaboradores" | "backup" | "historico" | "guia";
type ConfigurationResponse = { users: PortalUser[]; collaborators: ConfiguredCollaborator[]; history: PortalAuditEntry[] };

const MODULES: Array<{ id: PortalModule; label: string }> = [
  { id: "painel", label: "Avisos/Painel" },
  { id: "agenda", label: "Agenda Ciça" },
  { id: "compras", label: "Compras" },
  { id: "conferencia", label: "Conferência" },
  { id: "estoque", label: "Estoque" },
  { id: "motorista", label: "Motorista" },
  { id: "reunioes", label: "Reuniões" },
  { id: "leads", label: "Leads" },
  { id: "marketing", label: "Marketing" },
  { id: "financeiro", label: "Financeiro" },
];
const BOXES = MODULES.filter((item) => ["painel", "agenda", "compras", "conferencia", "estoque", "motorista", "reunioes", "leads"].includes(item.id));
const EMPTY_USER: PortalUser = { name: "", email: "", unit: "Rio Claro", modules: ["painel"], boxes: [], requiresPassword: false, readOnly: true, active: true, directPainel: true };
const EMPTY_COLLABORATOR: ConfiguredCollaborator = { id: "", name: "", unit: "Rio Claro", active: true, noticeRequired: true, updatedAt: "" };

function dateLabel(value?: string) {
  if (!value) return "Ainda não registrado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(date);
}

function Checkbox({ checked, label, disabled, onChange }: { checked: boolean; label: string; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-sm ${checked ? "border-blue-300 bg-blue-50 text-blue-950" : "border-slate-200 bg-white text-slate-700"} ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-blue-700" />
      <span>{label}</span>
    </label>
  );
}

function GuideItem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-950">
        <span>{title}</span>
        <span className="text-lg text-blue-700 transition group-open:rotate-45">+</span>
      </summary>
      <div className="mt-3 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-600">{children}</div>
    </details>
  );
}

export default function ConfiguracoesClient() {
  const [data, setData] = useState<ConfigurationResponse>({ users: [], collaborators: [], history: [] });
  const [tab, setTab] = useState<Tab>("acessos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [userForm, setUserForm] = useState<PortalUser | null>(null);
  const [collaboratorForm, setCollaboratorForm] = useState<ConfiguredCollaborator | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/configuracoes", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar.");
      setData({ users: result.users || [], collaborators: result.collaborators || [], history: result.history || [] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const activeUsers = data.users.filter((user) => user.active !== false).length;
  const activeCollaborators = data.collaborators.filter((member) => member.active).length;

  function toggleModule(module: PortalModule, checked: boolean) {
    setUserForm((current) => current ? {
      ...current,
      modules: checked ? [...new Set([...current.modules, module])] : current.modules.filter((item) => item !== module),
      boxes: checked ? current.boxes : (current.boxes || []).filter((item) => item !== module),
    } : current);
  }

  async function save(section: "user" | "collaborator", item: PortalUser | ConfiguredCollaborator) {
    setSaving(true); setError(""); setFeedback("");
    try {
      const response = await fetch("/api/configuracoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, item }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      setFeedback("Alteração salva com sucesso.");
      setUserForm(null); setCollaboratorForm(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally { setSaving(false); }
  }

  async function downloadBackup(prefix = "portal-timoni-backup") {
    const response = await fetch("/api/configuracoes/backup", { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível gerar o backup.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function restoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!window.confirm("Restaurar este backup? O Portal fará antes uma cópia automática do estado atual.")) return;
    setSaving(true); setError(""); setFeedback("");
    try {
      await downloadBackup("antes-da-restauracao");
      const formData = new FormData(); formData.append("backup", file);
      const response = await fetch("/api/configuracoes/backup", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível restaurar.");
      setFeedback("Backup restaurado com sucesso.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível restaurar.");
    } finally { setSaving(false); }
  }

  const tabs: Array<[Tab, string]> = [["acessos", "Acessos e permissões"], ["colaboradores", "Colaboradores"], ["backup", "Backup"], ["historico", "Histórico"], ["guia", "Guia de uso"]];

  function renderUserEditor(inline = false) {
    if (!userForm) return null;
    const isExisting = data.users.some((user) => user.email === userForm.email);
    return (
      <div className={inline ? "mt-4 border-t border-blue-100 pt-4" : "rounded-3xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6"}>
        <h3 className="text-base font-semibold text-slate-950 sm:text-lg">{isExisting ? "Editar permissões" : "Novo acesso"}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">Nome<input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">E-mail<input type="email" value={userForm.email} disabled={isExisting} onChange={(e) => setUserForm({ ...userForm, email: e.target.value.toLowerCase() })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-100" /></label>
          <label className="text-sm font-medium text-slate-700">Unidade<select value={userForm.unit} onChange={(e) => setUserForm({ ...userForm, unit: e.target.value as PortalUser["unit"] })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option>Rio Claro</option><option>Araras</option><option>Geral</option></select></label>
        </div>
        <div className="mt-5"><p className="text-sm font-semibold text-slate-900">Permissões dos módulos</p><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{MODULES.map((module) => <Checkbox key={module.id} label={module.label} checked={userForm.modules.includes(module.id)} disabled={userForm.email === "mcrodini@gmail.com"} onChange={(checked) => toggleModule(module.id, checked)} />)}</div></div>
        <div className="mt-5"><p className="text-sm font-semibold text-slate-900">Boxes visíveis no Painel</p><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{BOXES.map((box) => <Checkbox key={box.id} label={box.label} checked={(userForm.boxes || []).includes(box.id)} disabled={!userForm.modules.includes(box.id)} onChange={(checked) => setUserForm({ ...userForm, boxes: checked ? [...new Set([...(userForm.boxes || []), box.id])] : (userForm.boxes || []).filter((item) => item !== box.id) })} />)}</div></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <Checkbox label="Acesso ativo" checked={userForm.active !== false} disabled={userForm.email === "mcrodini@gmail.com"} onChange={(checked) => setUserForm({ ...userForm, active: checked })} />
          <Checkbox label="Somente leitura" checked={Boolean(userForm.readOnly)} disabled={userForm.email === "mcrodini@gmail.com"} onChange={(checked) => setUserForm({ ...userForm, readOnly: checked })} />
          <Checkbox label="Entrar direto em Avisos" checked={Boolean(userForm.directPainel)} onChange={(checked) => setUserForm({ ...userForm, directPainel: checked })} />
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setUserForm(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button><button type="button" disabled={saving} onClick={() => void save("user", userForm)} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Salvando..." : "Salvar acesso"}</button></div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Acesso da gestão</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Configurações</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Gerencie quem utiliza o Portal, o que cada acesso pode abrir e quais boxes aparecem no Painel.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-2xl font-bold text-blue-950">{activeUsers}</p><p className="mt-1 text-sm text-blue-700">Acessos ativos</p></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-2xl font-bold text-emerald-950">{activeCollaborators}</p><p className="mt-1 text-sm text-emerald-700">Colaboradores ativos</p></div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><p className="text-sm font-semibold text-violet-950">Integrações</p><p className="mt-2 text-sm text-violet-700">Google e base do Portal conectados</p></div>
      </section>

      <nav className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Áreas das configurações">
        {tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold ${tab === id ? "bg-[#0b1f5e] text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{label}</button>)}
      </nav>

      {feedback && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{feedback}</p>}
      {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</p>}
      {loading ? <p className="mt-6 text-sm text-slate-500">Carregando configurações...</p> : null}

      {!loading && tab === "acessos" && (
        <section className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-semibold text-slate-950">Acessos</h2><p className="mt-1 text-sm text-slate-600">Permissão libera o módulo; box controla apenas o atalho no Painel.</p></div>
            <button type="button" onClick={() => setUserForm({ ...EMPTY_USER })} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">+ Novo acesso</button>
          </div>

          {userForm && !data.users.some((user) => user.email === userForm.email) && renderUserEditor()}

          <div className="grid items-start gap-3 lg:grid-cols-2">
            {[...data.users].sort((a, b) => a.name.localeCompare(b.name)).map((user) => {
              const editing = userForm?.email === user.email;
              return (
                <article key={user.email} className={`rounded-2xl border bg-white p-4 ${editing ? "border-blue-300 shadow-sm lg:col-span-2" : "border-slate-200"} ${user.active === false && !editing ? "opacity-65" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-semibold text-slate-950">{user.name}</p><p className="mt-1 text-sm text-slate-600">{user.email}</p><p className="mt-1 text-xs text-slate-500">{user.unit} · Último acesso: {dateLabel(user.lastAccess)}</p></div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.active === false ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-800"}`}>{user.active === false ? "Desativado" : "Ativo"}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{user.modules.length} módulos · {(user.boxes || []).length} boxes</p>
                  {!editing && <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setUserForm({ ...user, boxes: [...(user.boxes || [])], modules: [...user.modules] })} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-800">Editar permissões</button><button type="button" onClick={() => setUserForm({ ...user, email: "", name: `Cópia de ${user.name}`, lastAccess: "" })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Duplicar permissões</button></div>}
                  {editing && renderUserEditor(true)}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {!loading && tab === "colaboradores" && (
        <section className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-950">Colaboradores</h2><p className="mt-1 text-sm text-slate-600">Nomes utilizados na confirmação de leitura dos Avisos.</p></div><button type="button" onClick={() => setCollaboratorForm({ ...EMPTY_COLLABORATOR })} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">+ Novo colaborador</button></div>
          {collaboratorForm && <div className="rounded-3xl border border-blue-200 bg-white p-5 shadow-sm"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Nome<input value={collaboratorForm.name} onChange={(e) => setCollaboratorForm({ ...collaboratorForm, name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label><label className="text-sm font-medium text-slate-700">Unidade<select value={collaboratorForm.unit} onChange={(e) => setCollaboratorForm({ ...collaboratorForm, unit: e.target.value as ConfiguredCollaborator["unit"] })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option>Rio Claro</option><option>Araras</option></select></label></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><Checkbox label="Colaborador ativo" checked={collaboratorForm.active} onChange={(checked) => setCollaboratorForm({ ...collaboratorForm, active: checked })} /><Checkbox label="Exigir ciência dos Avisos" checked={collaboratorForm.noticeRequired} onChange={(checked) => setCollaboratorForm({ ...collaboratorForm, noticeRequired: checked })} /></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCollaboratorForm(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button><button type="button" disabled={saving} onClick={() => void save("collaborator", collaboratorForm)} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white">Salvar colaborador</button></div></div>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.collaborators.sort((a, b) => a.name.localeCompare(b.name)).map((member) => <article key={member.id} className={`rounded-2xl border border-slate-200 bg-white p-4 ${member.active ? "" : "opacity-60"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{member.name}</p><p className="mt-1 text-sm text-slate-600">{member.unit}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${member.noticeRequired ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{member.noticeRequired ? "Confirma Avisos" : "Sem confirmação"}</span></div><button type="button" onClick={() => setCollaboratorForm({ ...member })} className="mt-4 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-800">Editar</button></article>)}</div>
        </section>
      )}

      {!loading && tab === "backup" && <section className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold text-slate-950">Fazer backup</h2><p className="mt-2 text-sm leading-6 text-slate-600">Baixa um arquivo ZIP importável com acessos, colaboradores, Avisos, leituras e mensagens do Espaço Equipe.</p><button type="button" onClick={() => void downloadBackup()} className="mt-5 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white">Baixar backup agora</button></div><div className="rounded-3xl border border-amber-200 bg-amber-50 p-6"><h2 className="text-xl font-semibold text-amber-950">Restaurar backup</h2><p className="mt-2 text-sm leading-6 text-amber-800">Antes de restaurar, o Portal baixa automaticamente uma cópia do estado atual. Revise sempre o nome e a data do arquivo.</p><label className="mt-5 inline-flex cursor-pointer rounded-xl bg-amber-700 px-5 py-3 text-sm font-semibold text-white"><input type="file" accept=".zip" onChange={(event) => void restoreBackup(event)} className="sr-only" />Selecionar arquivo ZIP</label></div></section>}

      {!loading && tab === "historico" && <section className="mt-5"><h2 className="text-xl font-semibold text-slate-950">Histórico de alterações</h2><div className="mt-4 space-y-2">{data.history.length ? data.history.map((item, index) => <div key={`${item.date}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-slate-900">{item.action}</p><p className="text-xs text-slate-500">{dateLabel(item.date)}</p></div><p className="mt-1 text-sm text-slate-600">{item.details}</p></div>) : <p className="text-sm text-slate-500">Nenhuma alteração registrada.</p>}</div></section>}

      {!loading && tab === "guia" && (
        <section className="mt-5">
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Portal Timoni</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Guia de uso</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Consulte abaixo o funcionamento dos principais módulos. Abra cada tópico para ver as orientações. O Portal mostra a cada usuário apenas os módulos liberados para o seu acesso.</p>
          </div>
          <div className="mt-4 grid gap-3">
            <GuideItem title="1. Painel e Avisos">
              <p>O Painel é o ponto inicial do Portal. Use os boxes para entrar nos módulos disponíveis. Em Avisos, leia os comunicados da unidade e, quando o seu acesso exigir confirmação, registre a ciência pelo botão disponível no card.</p>
            </GuideItem>
            <GuideItem title="2. Motorista">
              <p>No Dashboard do Motorista, consulte viagens, bloqueios, endereços, observações e situação de cada serviço. Use os botões de ação somente quando necessário e confira data, empresa, NF/Pedido e endereço antes de alterar um registro. A tela pública do motorista recebe as atualizações do mesmo cadastro.</p>
            </GuideItem>
            <GuideItem title="3. Compras">
              <p>Use Compras para acompanhar demandas, pedidos e informações enviadas ao processo de compra. Antes de atualizar um pedido, confira fornecedor, número do pedido, empresa, unidade e itens. Utilize Consulta quando a necessidade ainda não for um pedido efetivamente realizado.</p>
            </GuideItem>
            <GuideItem title="4. Estoque">
              <p>O Estoque concentra consultas e solicitações de produtos e acompanha os pedidos integrados com Compras. Sempre confira a unidade correta, os itens e o status antes de responder ou dar andamento.</p>
            </GuideItem>
            <GuideItem title="5. Leads">
              <p>Em Leads, acompanhe as listas FOLLOW UP e A PROSPECTAR. Registre contatos, próxima data e observações. Use STATUS para transferir o cliente entre as listas e consulte os indicadores para acompanhar realizado, pendente e evolução do trabalho comercial.</p>
            </GuideItem>
            <GuideItem title="6. Reuniões e demais módulos">
              <p>Use cada módulo apenas para a finalidade indicada no Portal. Os conteúdos e botões disponíveis variam conforme a permissão do usuário. Quando um módulo não aparecer no cabeçalho ou no Painel, ele não está liberado para aquele acesso.</p>
            </GuideItem>
            <GuideItem title="7. Configurações — Ciça e Marcelo">
              <p>Configurações é uma área de gestão. Ciça e Marcelo podem administrar acessos, permissões, boxes do Painel, colaboradores, backups e histórico. Ao alterar permissões, revise com cuidado quais módulos e boxes ficarão disponíveis para cada usuário.</p>
            </GuideItem>
            <GuideItem title="8. Backup e restauração">
              <p>Faça backups periódicos pelo botão Baixar backup agora. Para restaurar, selecione um ZIP válido. Antes da restauração, o Portal gera automaticamente uma cópia do estado atual. Confirme sempre o arquivo e a data antes de prosseguir.</p>
            </GuideItem>
            <GuideItem title="9. Boas práticas de uso">
              <p>Evite cadastros duplicados, confira unidade e datas antes de salvar e mantenha as observações objetivas. No celular, prefira os botões do próprio Portal e role horizontalmente os menus quando necessário. Se uma informação parecer desatualizada, atualize a página antes de repetir a operação.</p>
            </GuideItem>
          </div>
        </section>
      )}
    </div>
  );
}
