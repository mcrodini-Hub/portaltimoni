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

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateFromString(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function monthGrid(base: Date) {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
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

function lojaLabel(loja?: string) {
  if (loja === "araras") return "Araras";
  if (loja === "rio_claro") return "Rio Claro";
  return loja || "";
}

function horaCurta(hora?: string) {
  return hora ? hora.slice(0, 5) : "--:--";
}

export default function MotoristaAgenda() {
  const [mes, setMes] = useState(() => new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(() => localDateString());
  const [viagens, setViagens] = useState<Record<string, Viagem[]>>({});
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [invalidos, setInvalidos] = useState<Set<keyof FormState>>(new Set());

  const dias = useMemo(() => monthGrid(mes), [mes]);
  const itensSelecionados = viagens[diaSelecionado] || [];

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
  }, [mes]);

  function irHoje() {
    const hoje = new Date();
    setMes(hoje);
    setDiaSelecionado(localDateString(hoje));
  }

  function abrirNova(data?: string) {
    setForm(emptyForm(data || diaSelecionado));
    setInvalidos(new Set());
    setErro("");
    setModal(true);
  }

  function selecionarDia(data: string) {
    setDiaSelecionado(data);
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
      setDiaSelecionado(form.data);
      setMes(dateFromString(form.data));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  function imprimirDia() {
    const itens = itensSelecionados.filter((v) => v.tipoHorario !== "Bloqueio");
    if (!itens.length) {
      setErro("Não há entregas ou retiradas agendadas neste dia para imprimir.");
      return;
    }

    const data = dateFromString(diaSelecionado);
    const diaSemana = data.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    const dataLabel = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const linhas = itens
      .slice()
      .sort((a, b) => String(a.horario || "").localeCompare(String(b.horario || "")))
      .map((v, index) => {
        const endereco = [v.endereco, v.complemento].filter(Boolean).join(" - ");
        return `
          <div class="item">
            <p><strong>${index + 1}. ${horaCurta(v.horario)} ${v.tipoHorario || "Entrega"} ${lojaLabel(v.loja).toLowerCase()} - Vendedor: ${v.vendedor || ""}</strong></p>
            <p>${v.clienteFornecedor || ""} ${v.numeroPedido || ""} Volume: ${v.volumes || ""}</p>
            ${endereco ? `<p>${endereco}</p>` : ""}
            ${(v.contatoNome || v.contatoWhats) ? `<p>Contato: ${[v.contatoNome, v.contatoWhats].filter(Boolean).join(" - ")}</p>` : ""}
            ${v.info ? `<p>Observação: ${v.info}</p>` : ""}
          </div>`;
      })
      .join("");

    const janela = window.open("", "_blank", "width=900,height=700");
    if (!janela) {
      setErro("O navegador bloqueou a janela de impressão. Libere pop-ups para o Portal Timoni.");
      return;
    }
    janela.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Agenda Motorista ${dataLabel}</title><style>
      @page { size: A4; margin: 16mm; }
      body { font-family: Arial, sans-serif; color: #111; font-size: 13px; line-height: 1.35; }
      h1 { font-size: 18px; margin: 0 0 24px; }
      .item { margin: 0 0 18px; page-break-inside: avoid; }
      p { margin: 3px 0; }
    </style></head><body><h1>AGENDA MOTORISTA - DIA ${dataLabel} - ${diaSemana}</h1>${linhas}</body></html>`);
    janela.document.close();
    janela.focus();
    janela.print();
  }

  const mesLabel = mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const diaLabel = dateFromString(diaSelecionado).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => abrirNova()} className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900">Nova viagem</button>
            <button type="button" onClick={imprimirDia} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Imprimir dia</button>
            <span className="hidden h-7 w-px bg-slate-200 sm:block" />
            <button type="button" onClick={() => setMes((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">← Mês</button>
            <button type="button" onClick={irHoje} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Hoje</button>
            <button type="button" onClick={() => setMes((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Mês →</button>
            <p className="ml-auto text-sm font-semibold capitalize text-slate-800">{mesLabel}</p>
          </div>
        </div>

        {erro && !modal && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="mt-4 grid grid-cols-7 border-x border-t border-slate-200 bg-slate-50">
          {DIAS_SEMANA.map((dia) => (
            <div key={dia} className="border-b border-r border-slate-200 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 last:border-r-0">{dia}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-l border-slate-200">
          {dias.map((d) => {
            const data = localDateString(d);
            const itens = viagens[data] || [];
            const hoje = data === localDateString();
            const selecionado = data === diaSelecionado;
            const mesmoMes = d.getMonth() === mes.getMonth();
            return (
              <button
                key={data}
                type="button"
                onClick={() => selecionarDia(data)}
                className={`min-h-24 border-b border-r border-slate-200 p-2 text-left transition sm:min-h-28 ${selecionado ? "bg-blue-50 ring-2 ring-inset ring-blue-500" : hoje ? "bg-blue-50/50" : "bg-white hover:bg-slate-50"} ${!mesmoMes ? "opacity-45" : ""}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-semibold ${hoje ? "text-blue-800" : "text-slate-700"}`}>{d.getDate()}</span>
                  {itens.length > 0 && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{itens.length}</span>}
                </div>
                <div className="mt-1 space-y-1">
                  {loading ? (
                    <span className="text-[10px] text-slate-400">...</span>
                  ) : (
                    itens.slice(0, 3).map((v) => (
                      <div key={v.id} className={`truncate rounded px-1.5 py-1 text-[10px] ${v.tipoHorario === "Bloqueio" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
                        {horaCurta(v.horario)} · {v.clienteFornecedor || v.tipoHorario}
                      </div>
                    ))
                  )}
                  {itens.length > 3 && <p className="text-[10px] font-medium text-slate-500">+{itens.length - 3} mais</p>}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Dia selecionado</p>
            <h2 className="mt-1 text-base font-semibold capitalize text-slate-950">{diaLabel}</h2>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => abrirNova(diaSelecionado)} className="rounded-lg bg-blue-800 px-3 py-2 text-sm font-semibold text-white">Nova viagem neste dia</button>
            <button type="button" onClick={imprimirDia} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Imprimir dia</button>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {loading ? (
            <p className="text-sm text-slate-400">Carregando...</p>
          ) : itensSelecionados.length === 0 ? (
            <p className="text-sm text-slate-400">Sem viagens neste dia.</p>
          ) : (
            itensSelecionados.map((v, index) => (
              <div key={v.id} className={`rounded-xl border p-3 ${v.tipoHorario === "Bloqueio" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                <p className="text-sm font-semibold text-slate-950">{index + 1}. {horaCurta(v.horario)}{v.horarioFim ? ` a ${horaCurta(v.horarioFim)}` : ""} · {v.tipoHorario || "Viagem"} · {lojaLabel(v.loja)}</p>
                {v.vendedor && <p className="mt-1 text-xs text-slate-600">Vendedor: {v.vendedor}</p>}
                {v.clienteFornecedor && <p className="mt-1 text-sm text-slate-800">{v.clienteFornecedor}{v.numeroPedido ? ` · ${v.numeroPedido}` : ""}{v.volumes ? ` · Volume: ${v.volumes}` : ""}</p>}
              </div>
            ))
          )}
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
