from pathlib import Path

p = Path('timoni-portal/app/dashboard/motorista/motorista-agenda.tsx')
s = p.read_text(encoding='utf-8')

# Proteção: este script só pode alterar a tela da equipe.
if '/app/motorista/' in str(p).replace('\\', '/'):
    raise SystemExit('Arquivo de leitura não pode ser alterado')

s = s.replace('type Modo = "dia" | "mes";', 'type Modo = "dia" | "semana" | "mes";')

if 'function weekDays(' not in s:
    anchor = '''function monthDays(base: Date) {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    return d;
  });
}
'''
    helper = '''\nfunction weekDays(value: string) {
  const base = dateFromString(value);
  const day = base.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diffToMonday);
  return Array.from({ length: 7 }, (_, index) =>
    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index),
  );
}
'''
    if anchor not in s:
        raise SystemExit('monthDays anchor não encontrado')
    s = s.replace(anchor, anchor + helper)

if 'const diasSemana = useMemo' not in s:
    anchor = '  const diasMes = useMemo(() => monthDays(mesBase), [mesBase]);\n'
    if anchor not in s:
        raise SystemExit('diasMes anchor não encontrado')
    s = s.replace(anchor, anchor + '  const diasSemana = useMemo(() => weekDays(selecionado), [selecionado]);\n')

old_effect = '''  useEffect(() => {
    if (modo === "dia") void carregarDia(selecionado);
    else void carregarMes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, selecionado, mesBase]);
'''
new_effect = '''  useEffect(() => {
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
'''
if old_effect in s:
    s = s.replace(old_effect, new_effect)
elif 'modo === "semana"' not in s:
    raise SystemExit('useEffect esperado não encontrado')

old_buttons = '''            <button type="button" onClick={() => setModo("dia")} className={`rounded-lg px-3 py-2 text-sm font-medium ${modo === "dia" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}>Dia</button>
            <button type="button" onClick={() => setModo("mes")} className={`rounded-lg px-3 py-2 text-sm font-medium ${modo === "mes" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}>Mês</button>
'''
new_buttons = '''            <button type="button" onClick={() => setModo("dia")} className={`rounded-lg px-3 py-2 text-sm font-medium ${modo === "dia" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}>Dia</button>
            <button type="button" onClick={() => setModo("semana")} className={`rounded-lg px-3 py-2 text-sm font-medium ${modo === "semana" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}>Semana</button>
            <button type="button" onClick={() => setModo("mes")} className={`rounded-lg px-3 py-2 text-sm font-medium ${modo === "mes" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"}`}>Mês</button>
'''
if old_buttons in s:
    s = s.replace(old_buttons, new_buttons)
elif '>Semana</button>' not in s:
    raise SystemExit('Botões Dia/Mês não encontrados')

# Cabeçalho: Semana ganha navegação própria; Mês mantém a atual.
old_header_else = '''          ) : (
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => setMesBase((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">←</button>
              <p className="text-lg font-semibold capitalize text-slate-950">{mesBase.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>
              <button type="button" onClick={() => setMesBase((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">→</button>
            </div>
          )}
'''
new_header_else = '''          ) : modo === "semana" ? (
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
'''
if old_header_else in s:
    s = s.replace(old_header_else, new_header_else)
elif 'Agenda da semana' not in s:
    raise SystemExit('Cabeçalho Mês não encontrado')

old_content = '''        {modo === "dia" ? (
          <div className="mt-4 space-y-3">
'''
week_content = '''        {modo === "semana" ? (
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
                        <p className="text-sm font-semibold text-slate-950">{index + 1}. {v.tipoHorario || "Viagem"} {lojaLabel(v.loja)} | {horaCurta(v.horario)}{v.vendedor ? ` | ${v.vendedor}` : ""}</p>
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
'''
if old_content in s:
    s = s.replace(old_content, week_content, 1)
elif 'diasSemana.map' not in s:
    raise SystemExit('Conteúdo Dia não encontrado')

marker = '"use client";\n\n'
guard = '// MOTORISTA EQUIPE: manter Dia, Semana e Mês. A rota /motorista é leitura e não deve ser alterada por mudanças deste módulo.\n\n'
if guard not in s:
    s = s.replace(marker, marker + guard, 1)

p.write_text(s, encoding='utf-8')
