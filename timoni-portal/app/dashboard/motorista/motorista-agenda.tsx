"use client";

// MOTORISTA EQUIPE: manter Dia, Semana e Mês. A rota /motorista é leitura e não deve ser alterada por mudanças deste módulo.

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
  numero?: string;
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
  cep: string;
  endereco: string;
  numeroEndereco: string;
  linkEndereco: string;
  observacao: string;
  preenchidoPor: string;
};

type Modo = "dia" | "semana" | "mes";

const AUTORIZADOS = ["Ciça", "Thais", "Jaqueline", "Jeovana", "Margareth", "Reginaldo", "Carol Araras"] as const;

const REQUIRED: Array<keyof FormState> = [
  "loja",
  "vendedor",
  "data",
  "numeroPedido",
  "clienteFornecedor",
  "volumes",
  "contatoNome",
  "contatoWhats",
  "endereco",
  "numeroEndereco",
  "preenchidoPor",
];

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

function monthDays(base: Date) {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    return d;
  });
}

function weekDays(value: string) {
  const base = dateFromString(value);
  const day = base.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diffToMonday);
  return Array.from({ length: 7 }, (_, index) =>
    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index),
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
    cep: "",
    endereco: "",
    numeroEndereco: "",
    linkEndereco: "",
    observacao: "",
    preenchidoPor: "",
  };
}

function formFromViagem(v: Viagem): FormState {
  const bloqueio = v.tipoHorario === "Bloqueio";
  const enderecoCompleto = [v.endereco, v.numero, v.complemento].filter(Boolean).join(" - ");
  const match = enderecoCompleto.match(/\nLink:\s*(https?:\/\/\S+)/i);
  return {
    loja: v.loja || "",
    vendedor: v.vendedor || "",
    data: v.data,
    hora: bloqueio ? "" : (v.horario || "").slice(0, 5),
    bloquear: bloqueio,
    bloqueioInicio: bloqueio ? (v.horario || "").slice(0, 5) : "",
    bloqueioFim: bloqueio ? (v.horarioFim || "").slice(0, 5) : "",
    numeroPedido: v.numeroPedido || "",
    clienteFornecedor: v.clienteFornecedor || "",
    volumes: v.volumes || "",
    contatoNome: v.contatoNome || "",
    contatoWhats: v.contatoWhats || "",
    cep: "",
    endereco: enderecoCompleto.replace(/\nLink:\s*https?:\/\/\S+/i, "").trim(),
    numeroEndereco: v.numero || "",
    linkEndereco: match?.[1] || "",
    observacao: v.info || "",
    preenchidoPor: v.preenchidoPor || "",
  };
}

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) throw new Error(data?.erro || "Não foi possível acessar a agenda.");
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

function separarEndereco(endereco?: string) {
  const valor = endereco || "";
  const match = valor.match(/\nLink:\s*(https?:\/\/\S+)/i);
  return {
    texto: valor.replace(/\nLink:\s*https?:\/\/\S+/i, "").trim(),
    link: match?.[1] || "",
  };
}

function formatarCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function formatarTelefone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  const ddd = digits.slice(0, 2);
  const numero = digits.slice(2);
  if (numero.length <= 4) return `${ddd} ${numero}`;
  if (numero.length <= 8) return `${ddd} ${numero.slice(0, 4)}-${numero.slice(4)}`;
  return `${ddd} ${numero.slice(0, 5)}-${numero.slice(5)}`;
}

export default function MotoristaAgenda() {
  const hoje = localDateString();
  const [modo, setModo] = useState<Modo>("dia");
  const [selecionado, setSelecionado] = useState(hoje);
  const [mesBase, setMesBase] = useState(() => new Date());
  const [viagens, setViagens] = useState<Record<string, Viagem[]>>({});
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [invalidos, setInvalidos] = useState<Set<keyof FormState>>(new Set());

  const diasMes = useMemo(() => monthDays(mesBase), [mesBase]);
  const diasSemana = useMemo(() => weekDays(selecionado), [selecionado]);

  async function carregarDia(data = selecionado) {
    setLoading(true);
    setErro("");
    try {
      const response = await fetch(`/api/agenda-motorista?action=dia&data=${data}`, { cache: "no-store" });
      const body = await parseResponse(response);
      setViagens((current) => ({ ...current, [data]: body.viagens || [] }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar a agenda.");
    } finally {
      setLoading(false);
    }
  }

  async function carregarMes() {
    setLoading(true);
    setErro("");
    try {
      const pares = await Promise.all(
        diasMes.map(async (d) => {
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
    if (modo === "dia") {
      void carregarDia(selecionado);
    } else if (modo === "semana") {
      void (async () => {
        setLoading(true);
        setErro("");
        try {
          const pares = await Promise.all(
            diasSemana.map(async (d) => {
              const data = localDateString(d);
              const response = await fetch(`/api/agenda-motorista?action=dia&data=${data}`, { cache: "no-store" });
              const body = await parseResponse(response);
              return [data, body.viagens || []] as const;
            }),
          );
          setViagens((current) => ({ ...current, ...Object.fromEntries(pares) }));
        } catch (e) {
          setErro(e instanceof Error ? e.message : "Não foi possível carregar a semana.");
        } finally {
          setLoading(false);
        }
      })();
    } else {
      void carregarMes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, selecionado, mesBase, diasSemana]);

  function abrirNova(data = selecionado) {
    setEditandoId(null);
    setForm(emptyForm(data));
    setInvalidos(new Set());
    setErro("");
    setModal(true);
  }

  function abrirEditar(v: Viagem) {
    setEditandoId(v.id);
    setForm(formFromViagem(v));
    setInvalidos(new Set());
    setErro("");
    setModal(true);
  }

  function fieldClass(name: keyof FormState) {
    return `mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${invalidos.has(name) ? "border-red-500" : "border-slate-300"}`;
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

  async function buscarCep() {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) {
      setErro("Digite um CEP com 8 números.");
      return;
    }
    setErro("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!response.ok || data.erro) throw new Error("CEP não encontrado.");
      const endereco = [data.logradouro, data.bairro, [data.localidade, data.uf].filter(Boolean).join("/")].filter(Boolean).join(" - ");
      const linkMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
      set("endereco", endereco);
      set("numeroEndereco", "");
      set("linkEndereco", "");
      setErro("CEP localizado. Confirme o número do endereço para gerar o link do Google Maps.");
      set("linkEndereco", linkMaps);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível buscar o CEP.");
    }
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
      const enderecoCompleto = [form.endereco, form.numeroEndereco].filter(Boolean).join(", ");
      const linkMaps = form.linkEndereco || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;
      const detalhesEndereco = `${form.endereco}\nLink: ${linkMaps}`;
      const payload = new URLSearchParams({
        action: editandoId ? "atualizar" : "criar",
        ...(editandoId ? { id: editandoId } : {}),
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
        numero: form.numeroEndereco,
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
      setSelecionado(form.data);
      if (modo === "mes") await carregarMes();
      else await carregarDia(form.data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  function selecionarDia(data: string) {
    setSelecionado(data);
    setModo("dia");
  }

  function imprimirDia() {
    const itens = (viagens[selecionado] || [])
      .filter((v) => v.tipoHorario !== "Bloqueio")
      .slice()
      .sort((a, b) => (a.horario || "").localeCompare(b.horario || ""));

    if (!itens.length) {
      setErro("Não há entregas ou retiradas neste dia para imprimir.");
      return;
    }

    const data = dateFromString(selecionado);
    const diaSemana = data.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    const linhas = itens.map((v, index) => {
      const endereco = [v.endereco, v.numero, v.complemento].filter(Boolean).join(" - ");
      return `<div class="item"><p><strong>${index + 1}. ${v.tipoHorario || "Entrega"} ${lojaLabel(v.loja)} | ${horaCurta(v.horario)}${v.horarioFim ? ` a ${horaCurta(v.horarioFim)}` : ""}${v.vendedor ? ` | Vendedor: ${v.vendedor}` : ""}</strong></p><p>${v.clienteFornecedor || ""}${v.numeroPedido ? ` · ${v.numeroPedido}` : ""}${v.volumes ? ` · Volume: ${v.volumes}` : ""}</p><p>${endereco}</p><p>Contato: ${v.contatoNome || ""}${v.contatoWhats ? ` - ${v.contatoWhats}` : ""}</p>${v.info ? `<p>Observação: ${v.info}</p>` : ""}${v.preenchidoPor ? `<p class="preenchido">Preenchido por: ${v.preenchidoPor}</p>` : ""}</div>`;
    }).join("");

    const popup = window.open("", "_blank", "width=850,height=900");
    if (!popup) return;
    popup.document.write(`<!doctype html><html><head><title>Agenda Motorista</title><style>body{font-family:Arial,sans-serif;margin:28px;color:#111}h1{font-size:18px;margin-bottom:28px}.item{margin-bottom:24px;page-break-inside:avoid}.item p{margin:3px 0;font-family:Arial,sans-serif;font-size:11pt;line-height:1.35}.item .preenchido{font-size:10pt;margin-top:8px}</style></head><body><h1>AGENDA MOTORISTA - DIA ${data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} - ${diaSemana}</h1>${linhas}<script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }

  const itensDia = (viagens[selecionado] || []).slice().sort((a, b) => (a.horario || "").localeCompare(b.horario || ""));
  const dataSelecionada = dateFromString(selecionado);

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => abrirNova()} className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900">Nova viagem</button>
            <button type="button" onClick={imprimirDia} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Imprimir dia</button>
            <button type="button" onClick={() => setModo("dia")} className={`rounded-lg px-3 py-2 text-sm font-medium ${modo === "dia" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}>Dia</button>
            <button type="button" onClick={() => setModo("semana")} className={`rounded-lg px-3 py-2 text-sm font-medium ${modo === "semana" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}>Semana</button>
            <button type="button" onClick={() => setModo("mes")} className={`rounded-lg px-3 py-2 text-sm font-medium ${modo === "mes" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}>Mês</button>
          </div>

          {modo === "dia" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Agenda do dia</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{dataSelecionada.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSelecionado(localDateString(new Date(dataSelecionada.getFullYear(), dataSelecionada.getMonth(), dataSelecionada.getDate() - 1)))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">← Dia anterior</button>
                <button type="button" onClick={() => setSelecionado(hoje)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">Hoje</button>
                <button type="button" onClick={() => setSelecionado(localDateString(new Date(dataSelecionada.getFullYear(), dataSelecionada.getMonth(), dataSelecionada.getDate() + 1)))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">Próximo dia →</button>
              </div>
            </div>
          ) : modo === "semana" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Agenda da semana</p>
                <p className="mt-1 text-sm text-slate-600">Segunda a domingo</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { const d = dateFromString(selecionado); d.setDate(d.getDate() - 7); setSelecionado(localDateString(d)); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">← Semana anterior</button>
                <button type="button" onClick={() => setSelecionado(hoje)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">Hoje</button>
                <button type="button" onClick={() => { const d = dateFromString(selecionado); d.setDate(d.getDate() + 7); setSelecionado(localDateString(d)); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">Próxima semana →</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => setMesBase((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">←</button>
              <p className="text-lg font-semibold capitalize text-slate-950">{mesBase.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
              <button type="button" onClick={() => setMesBase((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">→</button>
            </div>
          )}
        </div>

        {erro && !modal && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        {modo === "semana" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {diasSemana.map((d) => {
              const data = localDateString(d);
              const itens = (viagens[data] || []).slice().sort((a, b) => (a.horario || "").localeCompare(b.horario || ""));
              return (
                <section key={data} className={`rounded-2xl border bg-white p-4 ${data === hoje ? "border-blue-300 bg-blue-50/40" : "border-slate-200"}`}>
                  <button type="button" onClick={() => selecionarDia(data)} className="w-full text-left">
                    <p className="text-xs font-semibold uppercase text-slate-500">{d.toLocaleDateString("pt-BR", { weekday: "long" })}</p>
                    <p className="mt-1 font-semibold text-slate-950">{d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}</p>
                  </button>
                  <div className="mt-3 space-y-2">
                    {loading ? <p className="text-sm text-slate-400">Carregando...</p> : itens.length === 0 ? <p className="text-sm text-slate-400">Sem viagens.</p> : itens.map((v, index) => (
                      <button key={v.id} type="button" onClick={() => abrirEditar(v)} className="block w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:bg-slate-100">
                        <p className="text-sm font-semibold text-slate-950">{index + 1}. {lojaLabel(v.loja)}{v.vendedor ? ` | Vend.: ${v.vendedor}` : ""}{v.horario ? ` | ${horaCurta(v.horario)}` : ""}</p>
                        {v.clienteFornecedor && <p className="mt-1 truncate text-xs text-slate-600">{v.clienteFornecedor}</p>}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : modo === "dia" ? (
          <div className="mt-4 space-y-3">
            {loading ? <p className="text-sm text-slate-400">Carregando...</p> : itensDia.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-400">Sem viagens neste dia.</p> : itensDia.map((v, index) => (
              <article key={v.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="font-[Arial] text-[11pt] leading-[1.35]">
                    <p className="font-semibold text-slate-950">{index + 1}. {v.tipoHorario || "Viagem"} {lojaLabel(v.loja)} | {horaCurta(v.horario)}{v.horarioFim ? ` a ${horaCurta(v.horarioFim)}` : ""}{v.vendedor ? ` | Vendedor: ${v.vendedor}` : ""}</p>
                    {v.tipoHorario !== "Bloqueio" && <>
                      <p className="mt-3 text-slate-900">{v.clienteFornecedor || ""}{v.numeroPedido ? ` · ${v.numeroPedido}` : ""}{v.volumes ? ` · Volume: ${v.volumes}` : ""}</p>
                      {v.endereco && <p className="mt-3 text-slate-700">
              {[separarEndereco(v.endereco).texto, v.numero, v.complemento].filter(Boolean).join(" - ")}
              {separarEndereco(v.endereco).link && <>{" · "}<a href={separarEndereco(v.endereco).link} target="_blank" rel="noreferrer" className="font-semibold text-blue-800 underline underline-offset-2">Abrir no Google Maps</a></>}
            </p>}
                      {(v.contatoNome || v.contatoWhats) && <p className="mt-3 text-slate-700">Contato: {[v.contatoNome, v.contatoWhats].filter(Boolean).join(" - ")}</p>}
                    </>}
                    {v.info && <p className="mt-3 text-slate-600">Observação: {v.info}</p>}
                    {v.preenchidoPor && <p className="mt-3 font-[Arial] text-[10pt] text-slate-500">Preenchido por: {v.preenchidoPor}</p>}
                  </div>
                  <button type="button" onClick={() => abrirEditar(v)} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">Editar</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-400"><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span></div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {diasMes.map((d) => {
                const data = localDateString(d);
                const itens = viagens[data] || [];
                const fora = d.getMonth() !== mesBase.getMonth();
                return <button key={data} type="button" onClick={() => selecionarDia(data)} className={`min-h-24 rounded-xl border p-2 text-left ${fora ? "border-slate-100 bg-slate-50 text-slate-300" : data === hoje ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}>
                  <p className="text-sm font-semibold">{d.getDate()}</p>
                  <div className="mt-1 space-y-1">{itens.slice(0, 3).map((v) => <p key={v.id} className="truncate text-[10px] text-slate-600">{horaCurta(v.horario)} {v.clienteFornecedor || v.tipoHorario}</p>)}{itens.length > 3 && <p className="text-[10px] text-slate-400">+{itens.length - 3}</p>}</div>
                </button>;
              })}
            </div>
          </div>
        )}
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-6">
          <form onSubmit={salvar} className="my-4 w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Motorista</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{editandoId ? "Editar agendamento" : "Nova viagem"}</h2><p className="mt-1 text-xs text-slate-500">Campos com * são obrigatórios.</p></div>
              <button type="button" onClick={() => setModal(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">Fechar</button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-medium text-slate-700">* Loja<select value={form.loja} onChange={(e) => set("loja", e.target.value)} className={fieldClass("loja")}><option value="">Selecione</option><option value="araras">Araras</option><option value="rio_claro">Rio Claro</option></select></label>
              <label className="text-sm font-medium text-slate-700">* Vendedor<select value={form.vendedor} onChange={(e) => set("vendedor", e.target.value)} className={fieldClass("vendedor")}><option value="">Selecione</option>{form.vendedor && !AUTORIZADOS.includes(form.vendedor as (typeof AUTORIZADOS)[number]) && <option value={form.vendedor}>{form.vendedor}</option>}{AUTORIZADOS.map((nome) => <option key={nome} value={nome}>{nome}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">* Data<input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} className={fieldClass("data")} /></label>
              <label className="text-sm font-medium text-slate-700">Hora<input type="time" value={form.hora} onChange={(e) => set("hora", e.target.value)} disabled={form.bloquear} className={`${fieldClass("hora")} disabled:bg-slate-100`} /></label>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800"><input type="checkbox" checked={form.bloquear} onChange={(e) => set("bloquear", e.target.checked)} />Bloquear horário</label>
              {form.bloquear && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm text-slate-700">De<input type="time" value={form.bloqueioInicio} onChange={(e) => set("bloqueioInicio", e.target.value)} className={fieldClass("bloqueioInicio")} /></label><label className="text-sm text-slate-700">Até<input type="time" value={form.bloqueioFim} onChange={(e) => set("bloqueioFim", e.target.value)} className={fieldClass("bloqueioFim")} /></label></div>}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">* NF/PEDIDO<input value={form.numeroPedido} onChange={(e) => set("numeroPedido", e.target.value)} className={fieldClass("numeroPedido")} /></label>
              <label className="text-sm font-medium text-slate-700">* CLIENTE/FORNECEDOR<input value={form.clienteFornecedor} onChange={(e) => set("clienteFornecedor", e.target.value)} className={fieldClass("clienteFornecedor")} /></label>
              <label className="text-sm font-medium text-slate-700">* Volume<input value={form.volumes} onChange={(e) => set("volumes", e.target.value)} className={fieldClass("volumes")} /></label>
              <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">* Contato<input value={form.contatoNome} onChange={(e) => set("contatoNome", e.target.value)} className={fieldClass("contatoNome")} /></label><label className="text-sm font-medium text-slate-700">* Tel/Cel<input value={form.contatoWhats} onChange={(e) => set("contatoWhats", formatarTelefone(e.target.value))} inputMode="tel" placeholder="19 98181-9171" className={fieldClass("contatoWhats")} /></label></div>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-2 sm:grid-cols-[220px_auto] sm:items-end"><label className="text-sm font-medium text-slate-700">CEP<input value={form.cep} onChange={(e) => set("cep", formatarCep(e.target.value))} inputMode="numeric" placeholder="00000-000" className={fieldClass("cep")} /></label><button type="button" onClick={buscarCep} className="h-[42px] rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Buscar CEP</button></div>
              <div className="grid gap-4 sm:grid-cols-[1fr_180px]"><label className="text-sm font-medium text-slate-700">* Endereço<input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} className={fieldClass("endereco")} /></label><label className="text-sm font-medium text-slate-700">* Número<input value={form.numeroEndereco} onChange={(e) => { const numero = e.target.value; set("numeroEndereco", numero); const destino = [form.endereco, numero].filter(Boolean).join(", "); set("linkEndereco", destino ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destino)}` : ""); }} placeholder="Confirme o número" className={fieldClass("numeroEndereco")} /></label></div>
              <label className="text-sm font-medium text-slate-700">Link endereço<input type="url" value={form.linkEndereco} onChange={(e) => set("linkEndereco", e.target.value)} placeholder="Gerado após informar o número" className={fieldClass("linkEndereco")} /></label>
              <label className="text-sm font-medium text-slate-700">Observação<textarea value={form.observacao} onChange={(e) => set("observacao", e.target.value)} rows={3} className={fieldClass("observacao")} /></label>
              <label className="text-sm font-medium text-slate-700">* Preenchido por<select value={form.preenchidoPor} onChange={(e) => set("preenchidoPor", e.target.value)} className={fieldClass("preenchidoPor")}><option value="">Selecione</option>{form.preenchidoPor && !AUTORIZADOS.includes(form.preenchidoPor as (typeof AUTORIZADOS)[number]) && <option value={form.preenchidoPor}>{form.preenchidoPor}</option>}{AUTORIZADOS.map((nome) => <option key={nome} value={nome}>{nome}</option>)}</select></label>
            </div>

            {erro && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setModal(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancelar</button><button type="submit" disabled={saving} className="rounded-lg bg-blue-800 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Salvando..." : editandoId ? "Salvar alterações" : "Salvar viagem"}</button></div>
          </form>
        </div>
      )}
    </>
  );
}
