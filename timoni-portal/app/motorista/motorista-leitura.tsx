"use client";

import { useEffect, useMemo, useState } from "react";

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

function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nextDays(start: Date) {
  return Array.from({ length: 7 }, (_, index) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  ).filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
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

function lerOperacao(notasJson?: string): "Entrega" | "Retirada" {
  try {
    const parsed = JSON.parse(String(notasJson || "[]"));
    return parsed && !Array.isArray(parsed) && parsed.operacao === "Retirada" ? "Retirada" : "Entrega";
  } catch {
    return "Entrega";
  }
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

function formatarVolume(valor?: string) {
  const info = separarVolume(valor);
  const base = [info.volume, info.unidade].filter(Boolean).join(" ");
  return [base, info.quantidade].filter(Boolean).join(" = ");
}

function finalizada(v: Viagem) {
  try {
    const parsed = JSON.parse(String(v.notasJson || "[]"));
    if (!parsed || Array.isArray(parsed)) return false;
    if (parsed.status === "feito") return true;
    if (parsed.status !== "concluida" && parsed.status !== "retirado") return false;

    const marcadoEm = parsed.status === "concluida" ? parsed.concluidoEm : parsed.retiradoEm;
    if (!marcadoEm) return true;

    const inicioDoDiaAgendado = new Date(`${v.data}T00:00:00-03:00`).getTime();
    const instanteMarcacao = new Date(String(marcadoEm)).getTime();
    if (!Number.isFinite(instanteMarcacao)) return true;

    return instanteMarcacao >= inicioDoDiaAgendado;
  } catch {
    return false;
  }
}

function concluida(notasJson?: string) {
  try {
    const parsed = JSON.parse(String(notasJson || "[]"));
    return Boolean(parsed && !Array.isArray(parsed) && parsed.status === "concluida");
  } catch {
    return false;
  }
}

export default function MotoristaLeitura() {
  const [inicio, setInicio] = useState(() => new Date());
  const [viagens, setViagens] = useState<Record<string, Viagem[]>>({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const dias = useMemo(() => nextDays(inicio), [inicio]);

  useEffect(() => {
    let ativo = true;
    let primeiraCarga = true;

    async function carregar() {
      if (primeiraCarga) setLoading(true);
      setErro("");
      try {
        const pares = await Promise.all(
          dias.map(async (d) => {
            const data = localDateString(d);
            const resposta = await fetch(`/api/motorista-leitura?action=dia&data=${data}&_=${Date.now()}`, {
              cache: "no-store",
            });
            const body = await resposta.json().catch(() => null);
            if (!resposta.ok || !body?.ok) throw new Error(body?.erro || "Não foi possível carregar a agenda.");
            return [data, body.viagens || []] as const;
          }),
        );
        if (ativo) setViagens(Object.fromEntries(pares));
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar a agenda.");
      } finally {
        if (ativo && primeiraCarga) setLoading(false);
        primeiraCarga = false;
      }
    }

    const atualizarAoVoltar = () => {
      if (document.visibilityState === "visible") void carregar();
    };

    void carregar();
    const intervalo = window.setInterval(() => void carregar(), 15_000);
    window.addEventListener("focus", atualizarAoVoltar);
    document.addEventListener("visibilitychange", atualizarAoVoltar);

    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      window.removeEventListener("focus", atualizarAoVoltar);
      document.removeEventListener("visibilitychange", atualizarAoVoltar);
    };
  }, [dias]);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-5">
      <div className="mx-auto max-w-5xl">
        <header className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">Casa Timoni</p>
          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Agenda do Motorista</h1>
              <p className="mt-1 text-sm text-slate-600">Visualização somente leitura.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setInicio((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">← 7 dias</button>
              <button type="button" onClick={() => setInicio(new Date())} className="rounded-lg bg-blue-800 px-3 py-2 text-sm font-semibold text-white">Hoje</button>
              <button type="button" onClick={() => setInicio((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">+ 7 dias</button>
            </div>
          </div>
        </header>

        {erro && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="space-y-4">
          {dias.map((d) => {
            const data = localDateString(d);
            const itens = (viagens[data] || [])
              .filter((v) => !finalizada(v))
              .slice()
              .sort((a, b) => (a.horario || "").localeCompare(b.horario || ""));
            const hoje = data === localDateString();
            return (
              <section key={data} className={`rounded-2xl border bg-white p-4 shadow-sm ${hoje ? "border-blue-300" : "border-slate-200"}`}>
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{d.toLocaleDateString("pt-BR", { weekday: "long" })}</p>
                    <h2 className="mt-0.5 text-lg font-semibold text-slate-950">{d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}</h2>
                  </div>
                  {hoje && <span className="rounded-full bg-blue-800 px-2.5 py-1 text-[10px] font-semibold text-white">Hoje</span>}
                </div>

                <div className="mt-3 space-y-3">
                  {loading ? (
                    <p className="text-sm text-slate-400">Carregando...</p>
                  ) : itens.length === 0 ? (
                    <p className="text-sm text-slate-400">Sem viagens.</p>
                  ) : (
                    itens.map((v, index) => {
                      const bloqueio = v.tipoHorario === "Bloqueio";
                      const enderecoInfo = separarEndereco(v.endereco);
                      const endereco = formatarEnderecoExibicao(v.endereco, v.numero, v.complemento);
                      return (
                        <article key={v.id} className={`rounded-xl border p-3 ${bloqueio ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-slate-950">
                                  {index + 1}. {lerOperacao(v.notasJson)} | {lojaLabel(v.loja)}{v.vendedor ? ` | Vend.: ${v.vendedor}` : ""}{v.horario ? ` | ${horaCurta(v.horario)}${v.horarioFim ? ` a ${horaCurta(v.horarioFim)}` : ""}` : ""}{bloqueio ? " | Bloqueio" : ""}
                                </p>
                                {!bloqueio && concluida(v.notasJson) && <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Concluído</span>}
                              </div>
                              {(v.clienteFornecedor || pedidoTexto(v.numeroPedido)) && (
                                <p className="mt-2 text-sm text-slate-900">Empresa: <strong>{v.clienteFornecedor || ""}{v.clienteFornecedor && pedidoTexto(v.numeroPedido) ? " | " : ""}{pedidoTexto(v.numeroPedido) ? `NF/Pedido: ${pedidoTexto(v.numeroPedido)}` : ""}</strong></p>
                              )}
                              {endereco && <p className="mt-1 text-sm text-slate-700">End.: {endereco}</p>}
                              {v.contatoNome && <p className="mt-1 text-sm text-slate-700">Falar com: {v.contatoNome}</p>}
                              {v.volumes && <p className="mt-1 text-sm text-slate-700">Volume: {formatarVolume(v.volumes)}</p>}
                              {v.info && <p className="mt-1 text-sm text-slate-600">Observação: <span className="whitespace-pre-line">{String(v.info).replace(/^[\r\n]+/, "")}</span></p>}
                              {enderecoInfo.link && <a href={enderecoInfo.link} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800">Google Maps</a>}
                              {v.preenchidoPor && <p className="mt-3 font-[Arial] text-[9px] text-slate-500">Preenchido por: {v.preenchidoPor}</p>}
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
