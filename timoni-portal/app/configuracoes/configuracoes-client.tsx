"use client";

import { useEffect, useMemo, useState } from "react";
import type { PortalModule, PortalUser } from "@/lib/access-control";
import type { ConfiguredCollaborator } from "@/lib/portal-config";

type ConfigurationResponse = {
  users: PortalUser[];
  collaborators: ConfiguredCollaborator[];
};

type Draft = {
  member: ConfiguredCollaborator;
  modules: PortalModule[];
  noticeRequired: boolean;
};

const MODULES: Array<{ id: PortalModule; label: string }> = [
  { id: "painel", label: "Avisos" },
  { id: "agenda", label: "Agenda Ciça" },
  { id: "agenda-ct", label: "Agenda CT" },
  { id: "chat", label: "Chat" },
  { id: "compras", label: "Compras" },
  { id: "conferencia", label: "Conferência" },
  { id: "estoque", label: "Estoque" },
  { id: "estoque-rotativo", label: "Rotativo" },
  { id: "motorista", label: "Motorista" },
  { id: "reunioes", label: "Reuniões" },
  { id: "leads", label: "Leads" },
];

const DASHBOARD_MODULES = new Set<PortalModule>([
  "painel", "agenda", "compras", "conferencia", "estoque", "estoque-rotativo", "motorista", "reunioes", "leads",
]);

function emptyMember(): ConfiguredCollaborator {
  return {
    id: "",
    name: "",
    role: "",
    unit: "Rio Claro",
    accessEmail: "",
    active: true,
    noticeRequired: true,
    chatEnabled: true,
    updatedAt: "",
  };
}

function accessLabel(user?: PortalUser) {
  if (!user) return "";
  return user.accessLabel || user.name || user.email;
}

function memberKey(member: ConfiguredCollaborator) {
  return member.id || `${member.unit}:${member.name}`;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export default function ConfiguracoesClient() {
  const [data, setData] = useState<ConfigurationResponse>({ users: [], collaborators: [] });
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterAccess, setFilterAccess] = useState("");
  const [filterModule, setFilterModule] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/configuracoes?t=${Date.now()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar as configurações.");
      setData({ users: result.users || [], collaborators: result.collaborators || [] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as configurações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const usersByEmail = useMemo(
    () => new Map(data.users.map((user) => [normalizeEmail(user.email), user])),
    [data.users],
  );

  const accessOptions = useMemo(
    () => [...data.users]
      .filter((user) => user.active !== false)
      .sort((a, b) => accessLabel(a).localeCompare(accessLabel(b), "pt-BR")),
    [data.users],
  );

  const visibleMembers = useMemo(() => {
    const term = filterName.trim().toLocaleLowerCase("pt-BR");
    return [...data.collaborators]
      .filter((member) => member.active !== false)
      .filter((member) => !term || member.name.toLocaleLowerCase("pt-BR").includes(term))
      .filter((member) => !filterAccess || normalizeEmail(member.accessEmail) === filterAccess)
      .filter((member) => {
        if (!filterModule) return true;
        const access = usersByEmail.get(normalizeEmail(member.accessEmail));
        return Boolean(access?.modules.includes(filterModule as PortalModule));
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) || a.unit.localeCompare(b.unit, "pt-BR"));
  }, [data.collaborators, filterName, filterAccess, filterModule, usersByEmail]);

  function startEdit(member: ConfiguredCollaborator) {
    const access = usersByEmail.get(normalizeEmail(member.accessEmail));
    setOpenId(memberKey(member));
    setEditingId(memberKey(member));
    setDraft({
      member: { ...member },
      modules: access ? [...access.modules] : [],
      noticeRequired: Boolean(access?.noticeRequired),
    });
    setError("");
    setMessage("");
  }

  function startNew() {
    const member = emptyMember();
    setOpenId("__new__");
    setEditingId("__new__");
    setDraft({ member, modules: [], noticeRequired: false });
    setError("");
    setMessage("");
  }

  function updateAccessEmail(email: string) {
    if (!draft) return;
    const normalized = normalizeEmail(email);
    const access = usersByEmail.get(normalized);
    setDraft({
      member: { ...draft.member, accessEmail: normalized },
      modules: access ? [...access.modules] : [],
      noticeRequired: Boolean(access?.noticeRequired),
    });
  }

  function toggleModule(module: PortalModule, checked: boolean) {
    if (!draft) return;
    setDraft({
      ...draft,
      modules: checked
        ? [...new Set([...draft.modules, module])]
        : draft.modules.filter((item) => item !== module),
    });
  }

  async function putUser(user: PortalUser) {
    const response = await fetch("/api/configuracoes", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ section: "user", item: user }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível salvar o acesso.");
    return result.item as PortalUser;
  }

  async function putMember(member: ConfiguredCollaborator) {
    const response = await fetch("/api/configuracoes", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ section: "collaborator", item: member }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível salvar o colaborador.");
    return result.item as ConfiguredCollaborator;
  }

  async function saveDraft() {
    if (!draft) return;
    const member = {
      ...draft.member,
      name: draft.member.name.trim(),
      role: draft.member.role.trim(),
      accessEmail: normalizeEmail(draft.member.accessEmail),
      active: true,
    };
    if (member.name.length < 2) {
      setError("Informe o nome do colaborador.");
      return;
    }
    if (member.accessEmail && !member.accessEmail.includes("@")) {
      setError("Informe um e-mail de acesso válido.");
      return;
    }

    const key = `save:${member.id || member.name}`;
    setBusy(key);
    setError("");
    setMessage("");
    try {
      let access = member.accessEmail ? usersByEmail.get(member.accessEmail) : undefined;

      if (member.accessEmail) {
        const boxes = draft.modules.filter((module) => DASHBOARD_MODULES.has(module));
        if (access) {
          access = await putUser({
            ...access,
            modules: [...draft.modules],
            boxes,
            mobileModules: access.mobileModules === undefined
              ? undefined
              : access.mobileModules.filter((module) => draft.modules.includes(module)),
            noticeRequired: draft.noticeRequired,
          });
        } else {
          access = await putUser({
            name: member.accessEmail,
            accessLabel: member.accessEmail,
            email: member.accessEmail,
            unit: member.unit === "Geral" ? "Geral" : member.unit,
            modules: [...draft.modules],
            boxes,
            mobileModules: [...draft.modules],
            requiresPassword: false,
            readOnly: false,
            active: true,
            directPainel: false,
            lastAccess: "",
            noticeRequired: draft.noticeRequired,
          });
        }
      }

      const updatedMember = await putMember(member);
      setData((current) => {
        const users = access
          ? current.users.some((item) => normalizeEmail(item.email) === normalizeEmail(access!.email))
            ? current.users.map((item) => normalizeEmail(item.email) === normalizeEmail(access!.email) ? access! : item)
            : [...current.users, access]
          : current.users;
        const collaborators = current.collaborators.some((item) => item.id === updatedMember.id)
          ? current.collaborators.map((item) => item.id === updatedMember.id ? updatedMember : item)
          : [...current.collaborators, updatedMember];
        return { users, collaborators };
      });
      setEditingId("");
      setDraft(null);
      setOpenId("");
      setMessage("Salvo.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy("");
    }
  }

  async function deleteMember(member: ConfiguredCollaborator) {
    if (!window.confirm(`Excluir ${member.name}?`)) return;
    setBusy(`delete:${member.id}`);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/configuracoes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ id: member.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível excluir.");
      setData((current) => ({
        ...current,
        collaborators: current.collaborators.filter((item) => item.id !== member.id),
      }));
      setOpenId("");
      setEditingId("");
      setDraft(null);
      setMessage("Colaborador excluído.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir.");
    } finally {
      setBusy("");
    }
  }

  function summaryModules(member: ConfiguredCollaborator) {
    const access = usersByEmail.get(normalizeEmail(member.accessEmail));
    if (!access) return [];
    return MODULES.filter((module) => access.modules.includes(module.id)).map((module) => module.label);
  }

  return (
    <div className="pb-10">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#13038D]">Configuração da equipe</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Colaboradores</h1>
          <p className="mt-1 text-sm text-slate-600">Cadastro, acesso e permissões no mesmo box. A configuração só precisa ser alterada quando houver mudança na equipe.</p>
        </div>
        <button type="button" onClick={startNew} className="rounded-xl bg-[#13038D] px-4 py-2.5 text-sm font-semibold text-white">+ Colaborador</button>
      </header>

      <section className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-2xl font-bold text-[#13038D]">{accessOptions.length}</p>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700">Acessos</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-2xl font-bold text-slate-950">{data.collaborators.filter((member) => member.active !== false).length}</p>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Colaboradores</p>
        </div>
      </section>

      <section className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-3">
        <label className="text-xs font-semibold text-slate-600">
          Colaborador
          <input value={filterName} onChange={(event) => setFilterName(event.target.value)} placeholder="Buscar nome" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Acesso
          <select value={filterAccess} onChange={(event) => setFilterAccess(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900">
            <option value="">Todos</option>
            {accessOptions.map((user) => <option key={user.email} value={normalizeEmail(user.email)}>{accessLabel(user)} · {user.email}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Módulo
          <select value={filterModule} onChange={(event) => setFilterModule(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900">
            <option value="">Todos</option>
            {MODULES.map((module) => <option key={module.id} value={module.id}>{module.label}</option>)}
          </select>
        </label>
      </section>

      {message && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{message}</p>}
      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

      {loading ? <p className="mt-5 text-sm text-slate-500">Carregando...</p> : (
        <section className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {openId === "__new__" && draft && (
            <article className="rounded-2xl border border-blue-200 bg-white shadow-sm md:col-span-2 xl:col-span-4">
              <div className="px-4 py-3">
                <p className="font-semibold text-slate-950">Novo colaborador</p>
              </div>
              <Editor
                draft={draft}
                accessOptions={accessOptions}
                busy={busy}
                onMemberChange={(member) => setDraft({ ...draft, member })}
                onAccessChange={updateAccessEmail}
                onModuleChange={toggleModule}
                onNoticeChange={(checked) => setDraft({ ...draft, noticeRequired: checked })}
                onSave={() => void saveDraft()}
                onCancel={() => { setOpenId(""); setEditingId(""); setDraft(null); }}
              />
            </article>
          )}

          {visibleMembers.map((member) => {
            const key = memberKey(member);
            const access = usersByEmail.get(normalizeEmail(member.accessEmail));
            const isOpen = openId === key;
            const isEditing = editingId === key && draft;
            const labels = summaryModules(member);
            return (
              <article key={key} className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${isOpen ? "md:col-span-2 xl:col-span-4" : ""}`}>
                <button
                  type="button"
                  onClick={() => {
                    if (isOpen) {
                      setOpenId("");
                      setEditingId("");
                      setDraft(null);
                    } else {
                      setOpenId(key);
                      setEditingId("");
                      setDraft(null);
                    }
                  }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{member.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{member.role || "Função não definida"} · {member.unit}</p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="truncate text-xs font-medium text-slate-700">{access ? accessLabel(access) : "Sem acesso"}</p>
                    <p className="truncate text-[11px] text-slate-400">{member.accessEmail || "—"}</p>
                  </div>
                  <span className="shrink-0 text-lg font-semibold text-[#13038D]">{isOpen ? "−" : "+"}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 p-4">
                    {isEditing && draft ? (
                      <Editor
                        draft={draft}
                        accessOptions={accessOptions}
                        busy={busy}
                        onMemberChange={(next) => setDraft({ ...draft, member: next })}
                        onAccessChange={updateAccessEmail}
                        onModuleChange={toggleModule}
                        onNoticeChange={(checked) => setDraft({ ...draft, noticeRequired: checked })}
                        onSave={() => void saveDraft()}
                        onCancel={() => { setEditingId(""); setDraft(null); }}
                        onDelete={() => void deleteMember(member)}
                      />
                    ) : (
                      <div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div><p className="text-[11px] font-semibold uppercase text-slate-400">Função</p><p className="mt-1 text-sm text-slate-800">{member.role || "Não definida"}</p></div>
                          <div><p className="text-[11px] font-semibold uppercase text-slate-400">Acesso</p><p className="mt-1 text-sm text-slate-800">{member.accessEmail || "Não vinculado"}</p></div>
                          <div><p className="text-[11px] font-semibold uppercase text-slate-400">Confirmação de leitura</p><p className="mt-1 text-sm text-slate-800">{access?.noticeRequired ? "Sim" : "Não"}</p></div>
                        </div>
                        <div className="mt-3">
                          <p className="text-[11px] font-semibold uppercase text-slate-400">Módulos</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {labels.length ? labels.map((label) => <span key={label} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-[#13038D]">{label}</span>) : <span className="text-sm text-slate-500">Nenhum módulo</span>}
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <button type="button" onClick={() => startEdit(member)} className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-[#13038D]">Editar</button>
                          <button type="button" disabled={busy === `delete:${member.id}`} onClick={() => void deleteMember(member)} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-[#D40C0D]">Excluir</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}

          {!visibleMembers.length && openId !== "__new__" && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-4">Nenhum colaborador encontrado.</p>}
        </section>
      )}
    </div>
  );
}

function Editor({
  draft,
  accessOptions,
  busy,
  onMemberChange,
  onAccessChange,
  onModuleChange,
  onNoticeChange,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: Draft;
  accessOptions: PortalUser[];
  busy: string;
  onMemberChange: (member: ConfiguredCollaborator) => void;
  onAccessChange: (email: string) => void;
  onModuleChange: (module: PortalModule, checked: boolean) => void;
  onNoticeChange: (checked: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const saving = busy.startsWith("save:");
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold text-slate-600">
          Nome
          <input value={draft.member.name} onChange={(event) => onMemberChange({ ...draft.member, name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-900" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Função
          <input value={draft.member.role} onChange={(event) => onMemberChange({ ...draft.member, role: event.target.value })} placeholder="Ex.: Vendedor" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-900" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Unidade
          <select value={draft.member.unit} onChange={(event) => onMemberChange({ ...draft.member, unit: event.target.value as ConfiguredCollaborator["unit"] })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900">
            <option>Geral</option>
            <option>Rio Claro</option>
            <option>Araras</option>
          </select>
        </label>
      </div>

      <label className="mt-3 block text-xs font-semibold text-slate-600">
        Acesso
        <input
          type="email"
          list="portal-access-emails"
          value={draft.member.accessEmail}
          onChange={(event) => onAccessChange(event.target.value)}
          placeholder="email@exemplo.com"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-900"
        />
        <datalist id="portal-access-emails">
          {accessOptions.map((user) => <option key={user.email} value={user.email}>{accessLabel(user)}</option>)}
        </datalist>
      </label>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Personalização</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {MODULES.map((module) => {
            const checked = draft.modules.includes(module.id);
            return (
              <label key={module.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium ${checked ? "border-blue-300 bg-blue-50 text-blue-950" : "border-slate-200 bg-white text-slate-700"}`}>
                <input type="checkbox" checked={checked} disabled={!draft.member.accessEmail} onChange={(event) => onModuleChange(module.id, event.target.checked)} className="h-4 w-4 accent-[#13038D]" />
                {module.label}
              </label>
            );
          })}
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={draft.noticeRequired} disabled={!draft.member.accessEmail} onChange={(event) => onNoticeChange(event.target.checked)} className="h-4 w-4 accent-[#13038D]" />
          Exige confirmação de leitura
        </label>
        {draft.member.accessEmail && <p className="mt-2 text-[11px] text-slate-500">Permissões são do acesso. Colaboradores que usam o mesmo e-mail ficam sincronizados.</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div>{onDelete && <button type="button" onClick={onDelete} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-[#D40C0D]">Excluir</button>}</div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancelar</button>
          <button type="button" disabled={saving} onClick={onSave} className="rounded-lg bg-[#13038D] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Salvando..." : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}
