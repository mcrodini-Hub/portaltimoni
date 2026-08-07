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
};

function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nextDays(start: Date, count = 7) {
  return Array.from({ length: count }, (_, index) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
}

function lojaLabel(loja?: string) {
  if (loja === "araras") return "Rio Claro".replace("Rio Claro", "Araras");
  if (loja === "rio_claro") return "Rio Claro";
  return loja || "";
}

function horaCurta(hora?: string) {
  return hora ? hora.slice(0, 5) : "--:--";
}

function diaSemanaCurto(d: Date) {
  return ["dom", "2ªf", "3ªf", "4ªf", "5ªf", "6ªf", "sáb"][d.getDay()];
}

export default function MotoristaLeitura() {
  const [inicio, setInicio] = useState(() => new Date());
  const [viagens, setViagens] = useState<Record<string, Viagem[]>>({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [printData, setPrintData] = useState<string | null>(null);

  const dias = useMemo(() => nextDays(inicio, 7), [inicio]);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setLoading(true);
      setErro("");
      try {
        const pares = await Promise.all(
          dias.map(async (d) => {
            const data = localDateString(d);
            const resposta = await fetch(`/api/motorista-leitura?action=dia&data=${data}`, { cache: "no-store" });
            const body = await resposta.json().catch(() => null);
            if (!resposta.ok || !body?.ok) throw new Error(body?.erro || "Não foi possível carregar a agenda.");
            return [data, body.viagens || []] as const;
          }),
        );
        if (ativo) setViagens(Object.fromEntries(pares));
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar a agenda.");
      } finally {
        if (ativo) setLoading(false);
      }
    }
    void carregar();
    return () => {
      ativo = false;
    };
  }, [dias]);

  function imprimirDia(data: string) {
    setPrintData(data);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => setPrintData(null), 100);
    }, 50);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-5">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-day { display: none !important; box-shadow: none !important; border: 0 !important; }
          .print-day.print-selected { display: block !important; padding: 0 !important; }
          .print-day .screen-day-header { display: none !important; }
          .print-only { display: block !important; }
          .print-item { border: 0 !important; background: white !important; padding: 0 0 18px 0 !important; }
          .print-number { display: none !important; }
          @page { size: A4; margin: 16mm; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>

      <div className="mx-auto max-w-5xl">
        <header className="no-print mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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

        {erro && <p className="no-print mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="space-y-4">
          {dias.map((d) => {
            const data = localDateString(d);
            const itens = viagens[data] || [];
            const hoje = data === localDateString();
            const selecionado = printData === data;
            return (
              <section key={data} className={`print-day ${selecionado ? "print-selected" : ""} rounded-2xl border bg-white p-4 shadow-sm ${hoje ? "border-blue-300" : "border-slate-200"}`}>
                <div className="print-only mb-8">
                  <h1 className="text-lg font-bold text-black">AGENDA MOTORISTA - DIA {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} - {diaSemanaCurto(d)}</h1>
                </div>

                <div className="screen-day-header flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{d.toLocaleDateString("pt-BR", { weekday: "long" })}</p>
                    <h2 className="mt-0.5 text-lg font-semibold text-slate-950">{d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}</h2>
                  </div>
                  <div className="no-print flex items-center gap-2">
                    {hoje && <span className="rounded-full bg-blue-800 px-2.5 py-1 text-[10px] font-semibold text-white">Hoje</span>}
                    <button type="button" onClick={() => imprimirDia(data)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Imprimir</button>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  {loading ? (
                    <p className="text-sm text-slate-400">Carregando...</p>
                  ) : itens.length === 0 ? (
                    <p className="text-sm text-slate-400">Sem viagens.</p>
                  ) : (
                    itens.map((v, index) => {
                      const bloqueio = v.tipoHorario === "Bloqueio";
                      const endereco = [v.endereco, v.numero, v.complemento].filter(Boolean).join(" - ");
                      return (
                        <article key={v.id} className={`print-item rounded-xl border p-3 ${bloqueio ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                          <div className="flex items-start gap-3">
                            <span className="print-number flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700 shadow-sm">{index + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-950 print:text-base print:font-normal print:text-black">
                                <span className="print-only">{index + 1}. </span>{horaCurta(v.horario)}{v.horarioFim ? ` a ${horaCurta(v.horarioFim)}` : ""} {v.tipoHorario || "Viagem"} {lojaLabel(v.loja).toLowerCase()} {v.vendedor ? `- Vendedor: ${v.vendedor}` : ""}
                              </p>
                              <p className="screen-day-header mt-0.5 text-xs text-slate-600">{v.vendedor ? `Vendedor: ${v.vendedor}` : ""}</p>
                              {!bloqueio && (
                                <>
                                  <p className="mt-2 text-sm font-medium text-slate-900 print:mt-1 print:text-base print:font-normal print:text-black">{v.clienteFornecedor || ""} {v.numeroPedido || ""} {v.volumes ? `Volume: ${v.volumes}` : "Volume:"}</p>
                                  {endereco && <p className="mt-1 text-sm text-slate-700 print:text-base print:text-black">{endereco}</p>}
                                  {(v.contatoNome || v.contatoWhats) && <p className="mt-1 text-sm text-slate-700 print:text-base print:text-black">Contato: {[v.contatoNome, v.contatoWhats].filter(Boolean).join(" - ")}</p>}
                                </>
                              )}
                              {v.info && <p className="mt-2 text-sm text-slate-600 print:text-base print:text-black">Observação: {v.info}</p>}
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
