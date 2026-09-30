"use client";

// MOTORISTA DASHBOARD: manter Dia, Semana e Mês. A rota /motorista (relatório/leitura) não deve ser alterada nesta reestruturação.

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BrazilianDateInput } from "@/components/ui/brazilian-date-input";

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
  notasJson?: string;
};

type FormState = {
  tipo: "Entrega" | "Retirada";
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
  unidadeVolume: string;
  quantidadeVolume: string;
  contatoNome: string;
  contatoWhats: string;
  cep: string;
  endereco: string;
  numeroEndereco: string;
  bairro: string;
  cidade: string;
  referencia: string;
  linkEndereco: string;
  discriminacao: string;
  preenchidoPor: string;
  notasJson: string;
};

type Modo = "dia" | "semana" | "mes";

type VendedorOption = { nome: string; unidade: string };
type ResponsavelOption = { email: string; name: string; unit: string };

const RESPONSAVEIS_RIO_CLARO = [
  { value: "Ciça", label: "Ciça" },
  { value: "Jaqueline", label: "Jaqueline" },
  { value: "Jeovana", label: "Jeovana" },
  { value: "Marcelo", label: "Marcelo" },
  { value: "Vendedores - Rio Claro", label: "Vendedores - Rio Claro" },
];

const ARARAS_EMAILS_EXCLUIDOS = new Set([
  "fotoscasatimoni@gmail.com",
  "estoqueararascasatimoni@gmail.com",
  "margareth@casatimoni.com.br",
]);

function normalizarUnidade(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

const REQUIRED: Array<keyof FormState> = [
  "tipo",
  "loja",
  "vendedor",
  "data",
  "numeroPedido",
  "clienteFornecedor",
  "volumes",
  "endereco",
  "numeroEndereco",
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
  return Array.from({ length: 7 }, (_, index) =>
    new Date(base.getFullYear(), base.getMonth(), base.getDate() + index),
  ).filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
}

function emptyForm(data = localDateString()): FormState {
  return {
    tipo: "Entrega",
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
    unidadeVolume: "",
    quantidadeVolume: "",
    contatoNome: "",
    contatoWhats: "",
    cep: "",
    endereco: "",
    numeroEndereco: "",
    bairro: "",
    cidade: "",
    referencia: "",
    linkEndereco: "",
    discriminacao: "",
    preenchidoPor: "",
    notasJson: "[]",
  };
}

function lerMetaMotorista(notasJson?: string) {
  try {
    const parsed = JSON.parse(String(notasJson || "[]"));
    if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
      return {
        tipo: parsed.tipo === "Retirada" ? "Retirada" as const : "Entrega" as const,
        cidade: String(parsed.cidade || ""),
        referencia: String(parsed.referencia || ""),
      };
    }
  } catch {}
  return { tipo: "Entrega" as const, cidade: "", referencia: "" };
}

function notasComMetaMotorista(
  notasJson: string | undefined,
  meta: { tipo: "Entrega" | "Retirada"; cidade: string; referencia: string },
) {
  let base: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(String(notasJson || "[]"));
    base = Array.isArray(parsed) ? { legado: parsed } : parsed && typeof parsed === "object" ? parsed : {};
  } catch {}
  return JSON.stringify({
    ...base,
    tipo: meta.tipo,
    cidade: meta.cidade.trim(),
    referencia: meta.referencia.trim(),
  });
}

function formFromViagem(v: Viagem): FormState {
  const bloqueio = v.tipoHorario === "Bloqueio";
  const enderecoCompleto = [v.endereco, v.numero, v.complemento].filter(Boolean).join(" - ");
  const match = enderecoCompleto.match(/\nLink:\s*(https?:\/\/\S+)/i);
  const enderecoSemLink = enderecoCompleto.replace(/\nLink:\s*https?:\/\/\S+/i, "").trim();
  const partesEndereco = enderecoSemLink.split(/\s+-\s+/).map((parte) => parte.trim()).filter(Boolean);
  const temCidadeUf = partesEndereco.length >= 3 && /\/[A-Z]{2}$/i.test(partesEndereco[partesEndereco.length - 1]);
  const meta = lerMetaMotorista(v.notasJson);
  const cidadeLegada = temCidadeUf ? partesEndereco[partesEndereco.length - 1] : "";
  const bairroLegado = temCidadeUf ? partesEndereco[partesEndereco.length - 2] : "";
  const enderecoEditavel = temCidadeUf
    ? partesEndereco.slice(0, -2).join(" - ")
    : (partesEndereco[0] || enderecoSemLink);
  const volumeInfo = separarVolume(v.volumes);
  return {
    tipo: meta.tipo,
    loja: v.loja || "",
    vendedor: v.vendedor || "",
    data: v.data,
    hora: "",
    bloquear: bloqueio,
    bloqueioInicio: bloqueio ? (v.horario || "").slice(0, 5) : "",
    bloqueioFim: bloqueio ? (v.horarioFim || "").slice(0, 5) : "",
    numeroPedido: v.numeroPedido || "",
    clienteFornecedor: v.clienteFornecedor || "",
    volumes: volumeInfo.volume,
    unidadeVolume: "",
    quantidadeVolume: "",
    contatoNome: v.contatoNome || "",
    contatoWhats: "",
    cep: "",
    endereco: enderecoEditavel,
    numeroEndereco: v.numero || "",
    bairro: bairroLegado,
    cidade: meta.cidade || cidadeLegada,
    referencia: meta.referencia || v.complemento || "",
    linkEndereco: match?.[1] || "",
    discriminacao: v.info || "",
    preenchidoPor: v.preenchidoPor || "",
    notasJson: v.notasJson || "[]",
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
  return hora ? hora.slice(0, 5) : "";
}

function separarEndereco(endereco?: string) {
  const valor = String(endereco ?? "");
  const match = valor.match(/\nLink:\s*(https?:\/\/\S+)/i);
  return {
    texto: valor.replace(/\nLink:\s*https?:\/\/\S+/i, "").trim(),
    link: match?.[1] || "",
  };
}

function montarEnderecoComBairro(endereco: string, bairro: string) {
  const enderecoLimpo = endereco.trim();
  const bairroLimpo = bairro.trim();
  if (!bairroLimpo) return enderecoLimpo;
  const partes = enderecoLimpo.split(/\s+-\s+/).map((parte) => parte.trim()).filter(Boolean);
  const ultima = partes[partes.length - 1] || "";
  return /\/[A-Z]{2}$/i.test(ultima)
    ? [...partes.slice(0, -1), bairroLimpo, ultima].join(" - ")
    : [enderecoLimpo, bairroLimpo].filter(Boolean).join(" - ");
}

function escaparRegex(valor: string) {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatarEnderecoExibicao(endereco?: string, numero?: string, complemento?: string) {
  const texto = separarEndereco(endereco).texto;
  const num = String(numero ?? "").trim();
  const comp = String(complemento ?? "").trim();
  let partes = texto.split(/\s+-\s+/).map((parte) => parte.trim()).filter(Boolean);
  if (num) {
    partes = partes.filter((parte) => parte !== num);
    if (partes[0]) {
      const fim = new RegExp(`(?:\\s*[,\-]?\\s*${escaparRegex(num)})+$`);
      partes[0] = partes[0].replace(fim, "").replace(/[\s,-]+$/, "").trim();
    }
  }
  const rua = partes.shift() || "";
  const inicio = rua && num ? `${rua}, ${num}` : rua || num;
  return [inicio, ...partes, comp && comp !== num ? comp : ""].filter(Boolean).join(" - ");
}

function pedidoTexto(valor?: string) {
  return String(valor ?? "").replace(/\s*\/\s*/g, " ").replace(/\s+/g, " ").trim();
}

function documentoTexto(valor?: string) {
  const texto = pedidoTexto(valor).trim();
  if (!texto) return "";
  if (/^ped\b/i.test(texto)) return texto.replace(/^ped\s*/i, "PED ");
  if (/^nf\b/i.test(texto)) return texto.replace(/^nf\s*/i, "NF ");
  return `NF ${texto}`;
}

function linhaPrincipalRelatorio(v: Viagem, index: number) {
  const tipo = lerMetaMotorista(v.notasJson).tipo;
  const partes = [
    `${index + 1}. ${tipo}`,
    v.tipoHorario === "Bloqueio" ? "Bloqueio" : "",
    lojaLabel(v.loja),
    v.vendedor ? `Vend.: ${v.vendedor}` : "",
    v.horario ? `${horaCurta(v.horario)}${v.horarioFim ? ` a ${horaCurta(v.horarioFim)}` : ""}` : "",
  ].filter(Boolean);
  return partes.join(" | ");
}

function separarVolume(valor?: string) {
  const texto = String(valor ?? "").trim();
  const unidadeMarcador = " | Unidade: ";
  const quantidadeMarcador = " | Quantidade: ";
  const indiceUnidade = texto.indexOf(unidadeMarcador);
  const indiceQuantidade = texto.indexOf(quantidadeMarcador);

  if (indiceUnidade >= 0) {
    const fimUnidade = indiceQuantidade >= 0 ? indiceQuantidade : texto.length;
    return {
      volume: texto.slice(0, indiceUnidade).trim(),
      unidade: texto.slice(indiceUnidade + unidadeMarcador.length, fimUnidade).trim(),
      quantidade: indiceQuantidade >= 0 ? texto.slice(indiceQuantidade + quantidadeMarcador.length).trim() : "",
    };
  }

  const combinado = texto.match(/^(\S+)\s+(.+)$/);
  return combinado
    ? { volume: combinado[1], unidade: combinado[2].trim(), quantidade: "" }
    : { volume: texto, unidade: "", quantidade: "" };
}

function formatarVolume(volume?: string, unidade?: string, quantidade?: string) {
  const vol = String(volume ?? "").trim();
  const un = String(unidade ?? "").trim();
  const qtd = String(quantidade ?? "").trim();
  const base = [vol, un].filter(Boolean).join(" ");
  return [base, qtd ? `Quantidade: ${qtd}` : ""].filter(Boolean).join(" | ");
}

function serializarVolume(volume?: string, unidade?: string, quantidade?: string) {
  const vol = String(volume ?? "").trim();
  const un = String(unidade ?? "").trim();
  const qtd = String(quantidade ?? "").trim();
  return [vol, un ? `Unidade: ${un}` : "", qtd ? `Quantidade: ${qtd}` : ""].filter(Boolean).join(" | ");
}

function lerConclusao(notasJson?: string) {
  try {
    const parsed = JSON.parse(String(notasJson || "[]"));
    if (parsed && !Array.isArray(parsed) && parsed.status === "concluida") return parsed as { status: string; observacaoConclusao?: string; concluidoEm?: string };
  } catch {}
  return null;
}

function notasComConclusao(notasJson: string | undefined, observacao: string) {
  let base: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(String(notasJson || "[]"));
    base = Array.isArray(parsed) ? { legado: parsed } : parsed && typeof parsed === "object" ? parsed : {};
  } catch {}
  return JSON.stringify({ ...base, status: "concluida", observacaoConclusao: observacao.trim(), concluidoEm: new Date().toISOString() });
}

function lerRetirada(notasJson?: string) {
  try {
    const parsed = JSON.parse(String(notasJson || "[]"));
    if (parsed && !Array.isArray(parsed) && parsed.status === "retirado") return parsed as { status: string; retiradoEm?: string };
  } catch {}
  return null;
}

function notasComRetirada(notasJson?: string) {
  let base: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(String(notasJson || "[]"));
    base = Array.isArray(parsed) ? { legado: parsed } : parsed && typeof parsed === "object" ? parsed : {};
  } catch {}
  return JSON.stringify({ ...base, status: "retirado", retiradoEm: new Date().toISOString() });
}

function formatarCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export default function MotoristaAgenda({ readOnly = false }: { readOnly?: boolean }) {
  const hoje = localDateString();
  const [modo, setModo] = useState<Modo>("semana");
  const [selecionado, setSelecionado] = useState(hoje);
  const [mesBase, setMesBase] = useState(() => new Date());
  const [viagens, setViagens] = useState<Record<string, Viagem[]>>({});
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [invalidos, setInvalidos] = useState<Set<keyof FormState>>(new Set());
  const [opcoesVendedores, setOpcoesVendedores] = useState<VendedorOption[]>([]);
  const [responsaveis, setResponsaveis] = useState<ResponsavelOption[]>([]);

  const diasMes = useMemo(() => monthDays(mesBase), [mesBase]);
  const diasSemana = useMemo(() => weekDays(selecionado), [selecionado]);
  const linkMapsFormulario = useMemo(() => {
    if (form.linkEndereco) return form.linkEndereco;
    if (!form.numeroEndereco.trim()) return "";
    const destino = [form.endereco.trim(), form.numeroEndereco.trim(), form.bairro.trim(), form.cidade.trim()].filter(Boolean).join(", ");
    return destino ? `https://maps.google.com/?q=${encodeURIComponent(destino)}` : "";
  }, [form.linkEndereco, form.endereco, form.numeroEndereco, form.bairro, form.cidade]);

  const vendedoresDisponiveis = useMemo(() => {
    const nomes = new Map<string, string>();
    for (const vendedor of opcoesVendedores) {
      const nome = String(vendedor.nome || "").trim();
      const chave = nome.toLocaleLowerCase("pt-BR");
      if (nome && !nomes.has(chave)) nomes.set(chave, nome);
    }
    return [...nomes.values()].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [opcoesVendedores]);

  const responsaveisAraras = useMemo(() => {
    const emailsAraras = new Set([
      "comercialara@casatimoni.com.br",
      "reginaldo@casatimoni.com.br",
      "estoqueararascasatimoni@gmail.com",
      "casatimoniararas@gmail.com",
      "fotoscasatimoni@gmail.com",
    ]);
    return responsaveis
      .filter((pessoa) => {
        const email = String(pessoa.email || "").trim().toLowerCase();
        const identidade = `${email} ${pessoa.name || ""}`.toLowerCase();
        const unidade = normalizarUnidade(String(pessoa.unit || ""));
        const pertenceAraras =
          unidade === "araras" ||
          normalizarUnidade(String(pessoa.name || "")).includes("araras") ||
          emailsAraras.has(email);
        const excluido =
          /lucas|margareth/i.test(identidade) ||
          ARARAS_EMAILS_EXCLUIDOS.has(email);
        return pertenceAraras && !excluido;
      })
      .map((pessoa) => String(pessoa.name || "").trim())
      .filter((nome, index, nomes) => Boolean(nome) && nomes.findIndex((item) => item.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR")) === index)
      .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [responsaveis]);

  useEffect(() => {
    let ativo = true;
    void fetch("/api/agenda-motorista-vendedores", { cache: "no-store" })
      .then(parseResponse)
      .then((body) => {
        if (!ativo) return;
        setOpcoesVendedores(Array.isArray(body.vendedores) ? body.vendedores : []);
        setResponsaveis(Array.isArray(body.responsaveis) ? body.responsaveis : []);
      })
      .catch(() => {
        // A agenda continua disponível; a rota já entrega listas de contingência quando a planilha falha.
      });
    return () => {
      ativo = false;
    };
  }, []);
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
    setAviso("");
    setModal(true);
  }

  function abrirEditar(v: Viagem) {
    setEditandoId(v.id);
    setForm(formFromViagem(v));
    setInvalidos(new Set());
    setErro("");
    setModal(true);
  }

  function duplicarViagem(v: Viagem) {
    setEditandoId(null);
    setForm({ ...formFromViagem(v), notasJson: "[]" });
    setInvalidos(new Set());
    setErro("");
    setAviso("");
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
      setAviso("");
      setErro("Digite um CEP com 8 números.");
      return;
    }
    setErro("");
    setAviso("");
    try {
      const response = await fetch(`/api/cep?cep=${encodeURIComponent(cep)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.erro || "CEP não encontrado.");
      const resultado = data.endereco || {};
      const cidadeUf = [resultado.cidade, resultado.uf].filter(Boolean).join("/");
      set("endereco", resultado.logradouro || "");
      set("bairro", resultado.bairro || "");
      set("cidade", cidadeUf);
      set("numeroEndereco", "");
      set("linkEndereco", "");
      setAviso("CEP localizado. Confirme o número para gerar o link do Google Maps.");
    } catch (e) {
      setAviso("");
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
      const enderecoBase = [form.endereco.trim(), form.bairro.trim(), form.cidade.trim()].filter(Boolean).join(" - ");
      const destinoMaps = [form.endereco.trim(), form.numeroEndereco.trim(), form.bairro.trim(), form.cidade.trim()].filter(Boolean).join(", ");
      const linkMaps = linkMapsFormulario || `https://maps.google.com/?q=${encodeURIComponent(destinoMaps)}`;
      const detalhesEndereco = `${enderecoBase}\nLink: ${linkMaps}`;
      const payload = new URLSearchParams({
        action: editandoId ? "atualizar" : "criar",
        ...(editandoId ? { id: editandoId } : {}),
        data: form.data,
        loja: form.loja,
        tipoHorario: form.bloquear ? "Bloqueio" : "Entrega",
        horario: form.bloquear ? form.bloqueioInicio : "",
        horarioFim: form.bloquear ? form.bloqueioFim : "",
        vendedor: form.vendedor,
        clienteFornecedor: form.clienteFornecedor.trim().toUpperCase(),
        numeroPedido: form.numeroPedido,
        volumes: form.volumes.trim(),
        contatoNome: form.contatoNome,
        contatoWhats: "",
        endereco: detalhesEndereco,
        numero: form.numeroEndereco,
        complemento: form.referencia,
        itens: "",
        info: form.discriminacao,
        preenchidoPor: form.preenchidoPor,
        dividir: "0",
        notasJson: notasComMetaMotorista(form.notasJson, {
          tipo: form.tipo,
          cidade: form.cidade,
          referencia: form.referencia,
        }),
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

  async function concluirViagem(v: Viagem) {
    if (lerConclusao(v.notasJson)) return;
    const observacao = window.prompt("Observação da conclusão (opcional):", "");
    if (observacao === null) return;
    setSaving(true);
    setErro("");
    try {
      const payload = new URLSearchParams({
        action: "atualizar",
        id: v.id,
        notasJson: notasComConclusao(v.notasJson, observacao),
      });
      const response = await fetch("/api/agenda-motorista", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: payload,
      });
      await parseResponse(response);
      await carregarDia(v.data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir a viagem.");
    } finally {
      setSaving(false);
    }
  }

  async function excluirViagem(v: Viagem) {
    if (!window.confirm("Excluir esta viagem definitivamente?")) return;
    setSaving(true);
    setErro("");
    try {
      const payload = new URLSearchParams({ action: "excluir", id: v.id });
      const response = await fetch("/api/agenda-motorista", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: payload,
      });
      await parseResponse(response);
      await carregarDia(v.data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir a viagem.");
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
      .slice()
      .sort((a, b) => (a.horario || "").localeCompare(b.horario || ""));

    if (!itens.length) {
      setErro("Não há registros neste dia para imprimir.");
      return;
    }

    const data = dateFromString(selecionado);
    const diaSemana = data.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    const linhas = itens.map((v, index) => {
      const tipo = lerMetaMotorista(v.notasJson).tipo;
      const endereco = formatarEnderecoExibicao(v.endereco, v.numero, v.complemento);
      const link = separarEndereco(v.endereco).link;
      const linha1 = linhaPrincipalRelatorio(v, index);
      const empresa = (v.clienteFornecedor || "").toUpperCase();
      const documento = documentoTexto(v.numeroPedido);
      const linha2 = [documento, empresa ? `${v.contatoNome ? "CLIENTE " : ""}${empresa}` : "", v.contatoNome ? `A/C: ${v.contatoNome.toUpperCase()}` : "", !v.contatoNome && v.volumes ? `VOLUME: ${String(v.volumes).toUpperCase()}` : ""].filter(Boolean).join(" | ");
      const volume = v.contatoNome && v.volumes ? `<p><strong>VOLUME: ${String(v.volumes).toUpperCase()}</strong></p>` : "";
      const detalhe = v.info ? `<p>${"Observação"}: ${String(v.info).replace(/^[\r\n]+/, "")}</p>` : "";
      const maps = link ? ` | <a href="${link}" target="_blank"><strong>Google Maps</strong></a>` : "";
      return `<div class="item"><p><strong>${linha1}</strong></p><p><strong>${linha2}</strong></p>${endereco ? `<p>End.: ${endereco}${maps}</p>` : ""}${volume}${detalhe}<p><strong>Preenchido por:</strong>${v.preenchidoPor ? ` ${v.preenchidoPor}` : ""}</p></div>`;
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
            {!readOnly && <button type="button" onClick={() => abrirNova()} className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900">Nova viagem</button>}
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
                <p className="mt-1 text-sm text-slate-600">{selecionado === hoje ? "A partir de hoje" : "A partir do dia selecionado"} · sem sábado e domingo</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { const d = dateFromString(selecionado); d.setDate(d.getDate() - 7); setSelecionado(localDateString(d)); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">− 7 dias</button>
                <button type="button" onClick={() => setSelecionado(hoje)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">Hoje</button>
                <button type="button" onClick={() => { const d = dateFromString(selecionado); d.setDate(d.getDate() + 7); setSelecionado(localDateString(d)); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">+ 7 dias</button>
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
          <div className="mt-4 space-y-4">
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
                      <article key={v.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-950">{linhaPrincipalRelatorio(v, index)}</p>
                        <p className="mt-2 text-sm font-bold uppercase text-slate-900">
                          {documentoTexto(v.numeroPedido)}
                          {documentoTexto(v.numeroPedido) && v.clienteFornecedor ? " | " : ""}
                          {v.clienteFornecedor ? <>{v.contatoNome ? "CLIENTE " : ""}{v.clienteFornecedor.toUpperCase()}</> : null}
                          {(documentoTexto(v.numeroPedido) || v.clienteFornecedor) && v.contatoNome ? " | " : ""}
                          {v.contatoNome ? <>A/C: {v.contatoNome.toUpperCase()}</> : null}
                          {!v.contatoNome && v.volumes ? <> | VOLUME: {String(v.volumes).toUpperCase()}</> : null}
                        </p>
                        {v.contatoNome && v.volumes && <p className="mt-1 text-sm font-bold uppercase text-slate-900">VOLUME: {String(v.volumes).toUpperCase()}</p>}
                        {v.endereco && <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-700"><span>End.: {formatarEnderecoExibicao(v.endereco, v.numero, v.complemento)}</span>{separarEndereco(v.endereco).link && <a href={separarEndereco(v.endereco).link} target="_blank" rel="noreferrer" className="font-semibold text-blue-800 underline underline-offset-2">Google Maps</a>}</p>}
                        {v.info && <p className="mt-1 text-sm text-slate-600">Observação: <span className="whitespace-pre-line">{String(v.info).replace(/^[\r\n]+/, "")}</span></p>}
                        <p className="mt-1 text-xs text-slate-500"><strong>Preenchido por:</strong>{v.preenchidoPor ? ` ${v.preenchidoPor}` : ""}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {lerConclusao(v.notasJson) ? <span className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">Concluído</span> : <button type="button" disabled={saving} onClick={() => void concluirViagem(v)} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Concluir</button>}
                          <button type="button" onClick={() => abrirEditar(v)} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50">Editar</button><button type="button" onClick={() => duplicarViagem(v)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Duplicar</button>
                          <button type="button" disabled={saving} onClick={() => void excluirViagem(v)} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">Excluir</button>
                        </div>
                        {lerConclusao(v.notasJson)?.observacaoConclusao && <p className="mt-2 text-xs text-emerald-800">Conclusão: {lerConclusao(v.notasJson)?.observacaoConclusao}</p>}
                      </article>
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
                    <p className="font-semibold text-slate-950">{linhaPrincipalRelatorio(v, index)}</p>
                    <p className="mt-2 font-bold uppercase text-slate-900">
                      {documentoTexto(v.numeroPedido)}
                      {documentoTexto(v.numeroPedido) && v.clienteFornecedor ? " | " : ""}
                      {v.clienteFornecedor ? <>{v.contatoNome ? "CLIENTE " : ""}{v.clienteFornecedor.toUpperCase()}</> : null}
                      {(documentoTexto(v.numeroPedido) || v.clienteFornecedor) && v.contatoNome ? " | " : ""}
                      {v.contatoNome ? <>A/C: {v.contatoNome.toUpperCase()}</> : null}
                      {!v.contatoNome && v.volumes ? <> | VOLUME: {String(v.volumes).toUpperCase()}</> : null}
                    </p>
                    {v.contatoNome && v.volumes && <p className="mt-1 font-bold uppercase text-slate-900">VOLUME: {String(v.volumes).toUpperCase()}</p>}
                    {v.endereco && <p className="mt-1 flex flex-wrap items-center gap-x-2 text-slate-700"><span>End.: {formatarEnderecoExibicao(v.endereco, v.numero, v.complemento)}</span>{separarEndereco(v.endereco).link && <a href={separarEndereco(v.endereco).link} target="_blank" rel="noreferrer" className="font-semibold text-blue-800 underline underline-offset-2">Google Maps</a>}</p>}
                    {v.info && <p className="mt-1 text-slate-600">Observação: <span className="whitespace-pre-line">{String(v.info).replace(/^[\r\n]+/, "")}</span></p>}
                    <p className="mt-1 font-[Arial] text-[10pt] text-slate-500"><strong>Preenchido por:</strong>{v.preenchidoPor ? ` ${v.preenchidoPor}` : ""}</p>
                  </div>
                  {!readOnly && <div className="flex flex-wrap gap-2">
                    {lerConclusao(v.notasJson) ? <span className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">Concluído</span> : <button type="button" disabled={saving} onClick={() => void concluirViagem(v)} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Concluir</button>}
                    <button type="button" onClick={() => abrirEditar(v)} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50">Editar</button><button type="button" onClick={() => duplicarViagem(v)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Duplicar</button>
                    <button type="button" disabled={saving} onClick={() => void excluirViagem(v)} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">Excluir</button>
                  </div>}
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

      {modal && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 sm:p-6">
          <form onSubmit={salvar} className="my-4 w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Motorista</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{editandoId ? "Editar agendamento" : "Nova viagem"}</h2><p className="mt-1 text-xs text-slate-500">Campos com * são obrigatórios.</p></div>
              <button type="button" onClick={() => setModal(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">Fechar</button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <label className="text-sm font-medium text-slate-700">* Tipo<select value={form.tipo} onChange={(e) => set("tipo", e.target.value as "Entrega" | "Retirada")} className={fieldClass("tipo")}><option value="Entrega">Entrega</option><option value="Retirada">Retirada</option></select></label>
              <label className="text-sm font-medium text-slate-700">* Loja<select value={form.loja} onChange={(e) => set("loja", e.target.value)} className={fieldClass("loja")}><option value="">Selecione</option><option value="Casa Timoni">Casa Timoni</option><option value="MCR">MCR</option><option value="Rodini">Rodini</option></select></label>
              <label className="text-sm font-medium text-slate-700">* Data<BrazilianDateInput value={form.data} onChange={(value) => set("data", value)} className={fieldClass("data")} required /></label>
              <label className="text-sm font-medium text-slate-700">* Vendedor<select value={form.vendedor} onChange={(e) => set("vendedor", e.target.value)} className={fieldClass("vendedor")} required><option value="">Selecione</option>{form.vendedor && !vendedoresDisponiveis.some((nome) => nome === form.vendedor) && <option value={form.vendedor}>{form.vendedor} (já registrado)</option>}{vendedoresDisponiveis.map((nome) => <option key={nome} value={nome}>{nome}</option>)}</select></label>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800"><input type="checkbox" checked={form.bloquear} onChange={(e) => set("bloquear", e.target.checked)} />Bloqueio</label>
              {form.bloquear && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm text-slate-700">Início<input type="time" value={form.bloqueioInicio} onChange={(e) => set("bloqueioInicio", e.target.value)} className={fieldClass("bloqueioInicio")} /></label><label className="text-sm text-slate-700">Fim<input type="time" value={form.bloqueioFim} onChange={(e) => set("bloqueioFim", e.target.value)} className={fieldClass("bloqueioFim")} /></label></div>}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">* Nota Fiscal/Pedido<input value={form.numeroPedido} onChange={(e) => set("numeroPedido", e.target.value)} className={fieldClass("numeroPedido")} /></label>
              <label className="text-sm font-medium text-slate-700">* Cliente/Fornecedor<input value={form.clienteFornecedor} onChange={(e) => set("clienteFornecedor", e.target.value.toUpperCase())} className={fieldClass("clienteFornecedor")} /></label>
              <label className="text-sm font-medium text-slate-700">A/C<input value={form.contatoNome} onChange={(e) => set("contatoNome", e.target.value)} className={fieldClass("contatoNome")} /></label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[220px_160px_1fr] md:items-end">
              <label className="text-sm font-medium text-slate-700">CEP<input value={form.cep} onChange={(e) => set("cep", formatarCep(e.target.value))} inputMode="numeric" placeholder="00000-000" className={fieldClass("cep")} /></label>
              <button type="button" onClick={buscarCep} className="h-[42px] rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Buscar CEP</button>
              <div className="text-sm font-medium text-slate-700">Link do endereço<div className="mt-1 flex h-[42px] items-center">{linkMapsFormulario ? <a href={linkMapsFormulario} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">Google Maps</a> : <span className="text-sm text-slate-400">Gerado após informar o número</span>}</div></div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_180px]">
              <label className="text-sm font-medium text-slate-700">* Endereço <span className="font-normal text-slate-400">(Rua / Av. / Rodovia)</span><input value={form.endereco} onChange={(e) => { set("endereco", e.target.value); set("linkEndereco", ""); }} className={fieldClass("endereco")} /></label>
              <label className="text-sm font-medium text-slate-700">* Número<input value={form.numeroEndereco} onChange={(e) => { const numero = e.target.value; set("numeroEndereco", numero); const destino = [form.endereco, numero, form.bairro, form.cidade].filter(Boolean).join(", "); set("linkEndereco", destino ? `https://maps.google.com/?q=${encodeURIComponent(destino)}` : ""); }} className={fieldClass("numeroEndereco")} /></label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">Bairro<input value={form.bairro} onChange={(e) => { set("bairro", e.target.value); set("linkEndereco", ""); }} className={fieldClass("bairro")} /></label>
              <label className="text-sm font-medium text-slate-700">Cidade<input value={form.cidade} onChange={(e) => { set("cidade", e.target.value); set("linkEndereco", ""); }} className={fieldClass("cidade")} /></label>
              <label className="text-sm font-medium text-slate-700">Referência<input value={form.referencia} onChange={(e) => set("referencia", e.target.value)} placeholder="Ex.: portão lateral" className={fieldClass("referencia")} /></label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
              <label className="text-sm font-medium text-slate-700">* Volume<input value={form.volumes} onChange={(e) => set("volumes", e.target.value)} placeholder="Ex.: 15" className={fieldClass("volumes")} /></label>
              <label className="text-sm font-medium text-slate-700">Discriminação<textarea value={form.discriminacao} onChange={(e) => set("discriminacao", e.target.value)} rows={4} placeholder={"Ex.:\n10 rolos de bolha\n5 sacos de Polifloc"} className={fieldClass("discriminacao")} /></label>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700">Preenchido por:<select value={form.preenchidoPor} onChange={(e) => set("preenchidoPor", e.target.value)} className={fieldClass("preenchidoPor")}><option value="">Selecione</option>{form.preenchidoPor && ![...RESPONSAVEIS_RIO_CLARO.map((pessoa) => pessoa.value), ...responsaveisAraras].includes(form.preenchidoPor) && <option value={form.preenchidoPor} disabled>{form.preenchidoPor} (já registrado)</option>}<optgroup label="Rio Claro">{RESPONSAVEIS_RIO_CLARO.map((pessoa) => <option key={pessoa.value} value={pessoa.value}>{pessoa.label}</option>)}</optgroup><optgroup label="Araras">{responsaveisAraras.length ? responsaveisAraras.map((nome) => <option key={nome} value={nome}>{nome}</option>) : <option value="" disabled>Nenhum acesso ativo encontrado</option>}</optgroup></select></label>
            </div>

            {aviso && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{aviso}</p>}
            {erro && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={() => setModal(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancelar</button><button type="submit" disabled={saving} className="rounded-lg bg-blue-800 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Salvando..." : editandoId ? "Salvar alterações" : "Salvar viagem"}</button></div>
          </form>
        </div>
      )}
    </>
  );
}
