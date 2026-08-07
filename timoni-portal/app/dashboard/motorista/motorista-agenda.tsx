"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Viagem = {
  id: string;
  data: string;
  loja?: string;
  tipoHorario?: string;
  horario?: string;
  horarioFim?: string;
  vendedor?: string;
  clienteFornecedor?: string;
  numeroPedido?: string;
  volumes?: string;
  contatoNome?: string;
  contatoWhats?: string;
  endereco?: string;
  complemento?: string;
  info?: string;
  preenchidoPor?: string;
};

type FormState = {
  loja: string;
  vendedor: string;
  data: string;
  hora: string;
  bloquear: boolean;
  bloqueioInicio: string;
  bloqueioFim: string;
  numeroPedido: string;
  clienteFornecedor: string;
  volumes: string;
  contatoNome: string;
  contatoWhats: string;
  endereco: string;
  linkEndereco: string;
  observacao: string;
  preenchidoPor: string;
};

const REQUIRED: Array<keyof FormState> = [
  "loja",
  "vendedor",
  "data",
  "numeroPedido",
  "clienteFornecedor",
  "contatoNome",
  "contatoWhats",
  "endereco",
  "preenchidoPor",
];

function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nextDays(start: Date, count = 7) {
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return d;
  });
}

function emptyForm(data = localDateString()): FormState {
  return {
    loja: "",
    vendedor: "",
    data,
    hora: "",
    bloquear: false,
    bloqueioInicio: "",
    bloqueioFim: "",
    numeroPedido: "",
    clienteFornecedor: "",
    volumes: "",
    contatoNome: "",
    contatoWhats: "",
    endereco: "",
    linkEndereco: "",
    observacao: "",
    preenchidoPor: "",
  };
}

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.erro || "Não foi possível acessar a agenda.");
  }
  return data;
}

export default function MotoristaAgenda() {
  const [inicio, setInicio] = useState(() => new Date());
  const [viagens, setViagens] = useState<Record<string, Viagem[]>>({});
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [invalidos, setInvalidos] = useState<Set<keyof FormState>>(new Set());

  const dias = useMemo(() => nextDays(inicio, 7), [inicio]);

  async function carregar() {
    setLoading(true);
    setErro("");
    try {
      const pares = await Promise.all(
        dias.map(async (d) => {
          const data = localDateString(d);
          const response = await fetch(`/api/agenda-motorista?action=dia&data=${data}`, { cache: "no-store" });
          const body = await parseResponse(response);
          return [data, body.viagens || []] as const;
        }),
      );
      setViagens(Object.fromEntries(pares));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a agenda.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio]);

  function abrirNova(data?: string) {
    setForm(emptyForm(data || localDateString()));
    setInvalidos(new Set());
    setErro("");
    setModal(true);
  }

  function fieldClass(name: keyof FormState) {
    return `mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
      invalidos.has(name) ? "border-red-500" : "border-slate-300"
    }`;
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setInvalidos((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  async function salvar(event: FormEvent) {
    event.preventDefault();
    const faltando = new Set<keyof FormState>();
    REQUIRED.forEach((key) => {
      if (!String(form[key] ?? "").trim()) faltando.add(key);
    });
    if (form.bloquear && (!form.bloqueioInicio || !form.bloqueioFim)) {
      faltando.add("bloqueioInicio");
      faltando.add("bloqueioFim");
    }
    setInvalidos(faltando);
    if (faltando.size) {
      setErro("Preencha os campos obrigatórios destacados em vermelho.");
      return;
    }

    setSaving(true);
    setErro("");
    try {
      const detalhesEndereco = form.linkEndereco ? `${form.endereco}\nLink: ${form.linkEndereco}` : form.endereco;
      const payload = new URLSearchParams({
        action: "criar",
        data: form.data,
        loja: form.loja,
        tipoHorario: form.bloquear ? "Bloqueio" : "Entrega",
        horario: form.bloquear ? form.bloqueioInicio : form.hora,
        horarioFim: form.bloquear ? form.bloqueioFim : "",
        vendedor: form.vendedor,
        clienteFornecedor: form.clienteFornecedor,
        numeroPedido: form.numeroPedido,
        volumes: form.volumes,
        contatoNome: form.contatoNome,
        contatoWhats: form.contatoWhats,
        endereco: detalhesEndereco,
        numero: "",
        complemento: "",
        itens: "",
        info: form.observacao,
        preenchidoPor: form.preenchidoPor,
        dividir: "0",
        notasJson: "[]",
      });
      const response = await fetch("/api/agenda-motorista", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: payload,
      });
      await parseResponse(response);
      setModal(false);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const dataInicio = dias[0];
  const dataFim = dias[dias.length - 1];
  const faixa = `${dataInicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} a ${dataFim.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Próximos 7 dias</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{faixa}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setInicio((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">← 7 dias</button>
            <button type="button" onClick={() => setInicio(new Date())} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Hoje</button>
            <button type="button" onClick={() => setInicio((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">+ 7 dias</button>
            <button type="button" onClick={() => abrirNova()} className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900">Nova viagem</button>
          </div>
        </div>

        {erro && !modal && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="mt-4 grid gap-3 lg:grid-cols-7">
          {dias.map((d) => {
            const data = localDateString(d);
            const itens = viagens[data] || [];
            const hoje = data === localDateString();
            return (
              <button key={data} type="button" onClick={() => abrirNova(data)} className={`min-h-40 rounded-2xl border p-3 text-left transition hover:border-blue-300 hover:shadow-sm ${hoje ? "border-blue-300 bg-blue-50/70" : "border-slate-200 bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">{d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</p>
                    <p className="text-lg font-semibold text-slate-950">{d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</p>
                  </div>
                  {hoje && <span className="rounded-full bg-blue-800 px-2 py-0.5 text-[10px] font-semibold text-white">Hoje</span>}
                </div>

                <div className="mt-3 space-y-2">
                  {loading ? (
                    <p className="text-xs text-slate-400">Carregando...</p>
                  ) : itens.length === 0 ? (
                    <p className="text-xs text-slate-400">Sem viagens</p>
                  ) : (
                    itens.map((v) => (
                      <div key={v.id} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <p className="truncate text-xs font-semibold text-slate-900">{v.horario || "--:--"} · {v.clienteFornecedor || v.tipoHorario}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{v.loja === "araras" ? "Araras" : v.loja === "rio_claro" ? "Rio Claro" : v.loja || ""}{v.vendedor ? ` · ${v.vendedor}` : ""}</p>
                      </div>
                    ))
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-6">
          <form onSubmit={salvar} className="my-4 w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Motorista</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Nova viagem</h2>
                <p className="mt-1 text-xs text-slate-500">Campos com * são obrigatórios.</p>
              </div>
              <button type="button" onClick={() => setModal(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">Fechar</button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-medium text-slate-700">* Loja
                <select value={form.loja} onChange={(e) => set("loja", e.target.value)} className={fieldClass("loja")}>
                  <option value="">Selecione</option>
                  <option value="araras">Araras</option>
                  <option value="rio_claro">Rio Claro</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">* Vendedor
                <input value={form.vendedor} onChange={(e) => set("vendedor", e.target.value)} className={fieldClass("vendedor")} />
              </label>
              <label className="text-sm font-medium text-slate-700">* Data
                <input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} className={fieldClass("data")} />
              </label>
              <label className="text-sm font-medium text-slate-700">Hora
                <input type="time" value={form.hora} onChange={(e) => set("hora", e.target.value)} disabled={form.bloquear} className={`${fieldClass("hora")} disabled:bg-slate-100`} />
              </label>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input type="checkbox" checked={form.bloquear} onChange={(e) => set("bloquear", e.target.checked)} />
                Bloquear horário
              </label>
              {form.bloquear && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-slate-700">De
                    <input type="time" value={form.bloqueioInicio} onChange={(e) => set("bloqueioInicio", e.target.value)} className={fieldClass("bloqueioInicio")} />
                  </label>
                  <label className="text-sm text-slate-700">Até
                    <input type="time" value={form.bloqueioFim} onChange={(e) => set("bloqueioFim", e.target.value)} className={fieldClass("bloqueioFim")} />
                  </label>
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">* NF/PEDIDO
                <input value={form.numeroPedido} onChange={(e) => set("numeroPedido", e.target.value)} className={fieldClass("numeroPedido")} />
              </label>
              <label className="text-sm font-medium text-slate-700">* CLIENTE/FORNECEDOR
                <input value={form.clienteFornecedor} onChange={(e) => set("clienteFornecedor", e.target.value)} className={fieldClass("clienteFornecedor")} />
              </label>
              <label className="text-sm font-medium text-slate-700">Volume
                <input value={form.volumes} onChange={(e) => set("volumes", e.target.value)} className={fieldClass("volumes")} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">* Contato
                  <input value={form.contatoNome} onChange={(e) => set("contatoNome", e.target.value)} className={fieldClass("contatoNome")} />
                </label>
                <label className="text-sm font-medium text-slate-700">* Tel/Cel
                  <input value={form.contatoWhats} onChange={(e) => set("contatoWhats", e.target.value)} className={fieldClass("contatoWhats")} />
                </label>
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="text-sm font-medium text-slate-700">* Endereço
                <input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} className={fieldClass("endereco")} />
              </label>
              <label className="text-sm font-medium text-slate-700">Link endereço
                <input type="url" value={form.linkEndereco} onChange={(e) => set("linkEndereco", e.target.value)} placeholder="https://maps.google.com/..." className={fieldClass("linkEndereco")} />
              </label>
              <label className="text-sm font-medium text-slate-700">Observação
                <textarea value={form.observacao} onChange={(e) => set("observacao", e.target.value)} rows={3} className={fieldClass("observacao")} />
              </label>
              <label className="text-sm font-medium text-slate-700">* Preenchido por
                <input value={form.preenchidoPor} onChange={(e) => set("preenchidoPor", e.target.value)} className={fieldClass("preenchidoPor")} />
              </label>
            </div>

            {erro && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => setModal(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancelar</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-blue-800 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Salvando..." : "Salvar viagem"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
