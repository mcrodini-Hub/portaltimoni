"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1cESMTRx98e6AbY5vxPCcT7VrqYAbgH0xGUk87ybqHUo/edit";

type RequestUnit = "rio_claro" | "araras";
type Unit = "todas" | RequestUnit;
type Need = {
  id: string;
  codigo: string;
  descricao: string;
  status: string;
  criadoEm: string;
  numeroPedido: string;
  previsaoEntrega: string;
  observacao: string;
  clienteAguardando: boolean;
  unidade: RequestUnit;
  vendedor: string;
  quantidade: string;
  notaVendedor: string;
};
type Product = { codigo: string; descricao: string; unidade: string };
type Seller = { nome: string; unidade: string };
type Counts = { emAberto: number; aguardandoCompra: number; aguardandoChegada: number; finalizadas: number };
type Summary = { geral: Counts; porUnidade: { rio_claro: Counts; araras: Counts } };
type Data = { ok: boolean; necessidades: Need[]; produtos: Product[]; vendedores: Seller[]; summary: Summary; error?: string };

type EstoqueClientProps = {
  isManager?: boolean;
  defaultUnit?: RequestUnit;
  allowedUnits?: RequestUnit[];
};

const empty: Counts = { emAberto: 0, aguardandoCompra: 0, aguardandoChegada: 0, finalizadas: 0 };
const emptySummary: Summary = { geral: { ...empty }, porUnidade: { rio_claro: { ...empty }, araras: { ...empty } } };
const cards: Array<[keyof Counts, string]> = [
  ["emAberto", "Em aberto"],
  ["aguardandoCompra", "Relação de compra"],
  ["aguardandoChegada", "A caminho"],
  ["finalizadas", "Finalizadas"],
];
const input = "rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm disabled:bg-slate-50 disabled:text-slate-500";
const primary = "rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700";

function norm(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function unitLabel(unit: RequestUnit) {
  return unit === "araras" ? "Araras" : "Rio Claro";
}

function findByCode(list: Product[], term: string) {
  const q = norm(term);
  if (!q) return [];
  return list
    .filter((product) => norm(product.codigo).startsWith(q))
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR"))
    .slice(0, 10);
}

function findByDescription(list: Product[], term: string) {
  const q = norm(term);
  const words = q.split(/\s+/).filter(Boolean);
  if (!q) return [];
  return list
    .filter((product) =>
      words.length > 1
        ? words.every((word) => norm(product.descricao).includes(word))
        : norm(product.descricao).startsWith(q) || norm(product.descricao).includes(q),
    )
    .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"))
    .slice(0, 10);
}

function label(status: string) {
  return (
    {
      pendente: "Em aberto",
      em_compra: "Relação de compra",
      pedido_existente: "A caminho",
      observacao: "Aguardando retorno",
      chegou: "Finalizado",
    } as Record<string, string>
  )[status] || status;
}

function date(value: string) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      }).format(d);
}

function timestamp(value: string) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function canUseNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

export default function EstoqueClient({ isManager = false, defaultUnit = "rio_claro", allowedUnits = ["rio_claro", "araras"] }: EstoqueClientProps) {
  const safeAllowedUnits = allowedUnits.length ? allowedUnits : [defaultUnit];
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needs, setNeeds] = useState<Need[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [unit, setUnit] = useState<Unit>("todas");
  const [newUnit, setNewUnit] = useState<RequestUnit>(defaultUnit);
  const [seller, setSeller] = useState("");
  const [codeSearch, setCodeSearch] = useState("");
  const [descriptionSearch, setDescriptionSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  const codeInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const waitingInputRef = useRef<HTMLInputElement>(null);
  const registerButtonRef = useRef<HTMLButtonElement>(null);
  const notificationInitializedRef = useRef(false);
  const notifiedNeedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!safeAllowedUnits.includes(newUnit)) {
      setNewUnit(safeAllowedUnits[0]);
      setSeller("");
    }
  }, [newUnit, safeAllowedUnits]);

  useEffect(() => {
    if (canUseNotifications()) setNotificationPermission(Notification.permission);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/estoque", { cache: "no-store" });
      const payload = (await response.json()) as Data;
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Falha ao carregar");
      setNeeds(payload.necessidades);
      setProducts(payload.produtos);
      setSellers(payload.vendedores);
      setSummary(payload.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isManager) return undefined;
    const timer = window.setInterval(() => {
      void refresh();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [isManager, refresh]);

  useEffect(() => {
    if (!isManager) return;
    const activeNeeds = needs.filter((need) => need.status !== "chegou");
    const currentIds = new Set(activeNeeds.map((need) => need.id));

    if (!notificationInitializedRef.current) {
      notifiedNeedIdsRef.current = currentIds;
      notificationInitializedRef.current = true;
      return;
    }

    const newNeeds = activeNeeds.filter((need) => !notifiedNeedIdsRef.current.has(need.id));
    notifiedNeedIdsRef.current = currentIds;

    if (!newNeeds.length || !canUseNotifications() || Notification.permission !== "granted") return;

    for (const need of newNeeds.slice(0, 3)) {
      new Notification("Nova necessidade no Estoque", {
        body: `${unitLabel(need.unidade)} · ${need.codigo} ${need.descricao}`,
      });
    }
  }, [isManager, needs]);

  async function requestNotifications() {
    if (!canUseNotifications()) {
      setNotice("Este navegador não permite notificações do Portal.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setNotice(permission === "granted" ? "Notificações do Estoque ativadas neste aparelho." : "Notificações não foram autorizadas neste aparelho.");
  }

  async function post(body: Record<string, unknown>, id = "geral") {
    setBusy(id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/estoque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; existing?: boolean };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Falha ao atualizar");
      setNotice(payload.existing ? "Produto já ativo; solicitação mantida." : "Atualização registrada.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar");
    } finally {
      setBusy("");
    }
  }

  async function order(need: Need) {
    const number = window.prompt("Número do pedido:", need.numeroPedido || "");
    if (number === null) return;
    const forecast = window.prompt("Previsão (AAAA-MM-DD):", need.previsaoEntrega || "");
    if (forecast === null) return;
    await post({ action: "pedido", id: need.id, numeroPedido: number, previsao: forecast }, need.id);
  }

  async function observe(need: Need) {
    const text = (responseDrafts[need.id] ?? need.observacao ?? "").trim();
    if (!text) {
      setError("Escreva a observação/resposta da necessidade.");
      return;
    }
    await post({ action: "observacao", id: need.id, texto: text }, need.id);
  }

  async function arrived(need: Need) {
    if (window.confirm(`Confirmar chegada de ${need.codigo}?`)) await post({ action: "chegou", id: need.id }, need.id);
  }

  function selectProduct(product: Product) {
    setSelected(product.codigo);
    setCodeSearch(product.codigo);
    setDescriptionSearch(product.descricao);
  }

  function resolveProduct() {
    const selectedProduct = products.find((product) => product.codigo === selected);
    if (selectedProduct) return selectedProduct;
    const byCode = products.find((product) => norm(product.codigo) === norm(codeSearch));
    if (byCode) return byCode;
    return products.find((product) => norm(product.descricao) === norm(descriptionSearch));
  }

  function chooseProductFromCode() {
    const exact = products.find((product) => norm(product.codigo) === norm(codeSearch));
    const product = exact || codeResults[0];
    if (product) selectProduct(product);
  }

  function chooseProductFromDescription() {
    const exact = products.find((product) => norm(product.descricao) === norm(descriptionSearch));
    const product = exact || descriptionResults[0];
    if (product) selectProduct(product);
  }

  function handleCodeKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    chooseProductFromCode();
    descriptionInputRef.current?.focus();
  }

  function handleDescriptionKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    chooseProductFromDescription();
    quantityInputRef.current?.focus();
  }

  function handleQuantityKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    noteInputRef.current?.focus();
  }

  function handleNoteKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    waitingInputRef.current?.focus();
  }

  function handleWaitingKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    setWaiting((value) => !value);
    registerButtonRef.current?.focus();
  }

  async function create() {
    const product = resolveProduct();
    if (!product) {
      setError("Selecione um produto pelo código ou pela descrição.");
      codeInputRef.current?.focus();
      return;
    }
    if (!seller) return setError("Selecione o vendedor.");
    await post({
      action: "criar",
      codigo: product.codigo,
      unidade: newUnit,
      vendedor: seller,
      quantidade: quantity,
      nota: note,
      clienteAguardando: waiting,
    });
    setCodeSearch("");
    setDescriptionSearch("");
    setSelected("");
    setQuantity("");
    setNote("");
    setWaiting(false);
    codeInputRef.current?.focus();
  }

  const sortedNeeds = useMemo(() => [...needs].sort((a, b) => timestamp(b.criadoEm) - timestamp(a.criadoEm)), [needs]);
  const filtered = useMemo(() => sortedNeeds.filter((need) => unit === "todas" || need.unidade === unit), [sortedNeeds, unit]);
  const openNeeds = filtered.filter((need) => ["pendente", "em_compra", "observacao"].includes(need.status));
  const onWay = filtered.filter((need) => need.status === "pedido_existente");
  const history = filtered.filter((need) => need.status === "chegou").slice(0, 50);
  const trackingNeeds = [...openNeeds, ...onWay];
  const codeResults = useMemo(() => (selected ? [] : findByCode(products, codeSearch)), [products, codeSearch, selected]);
  const descriptionResults = useMemo(() => (selected ? [] : findByDescription(products, descriptionSearch)), [products, descriptionSearch, selected]);
  const sellerOptions = sellers.filter((item) => !item.unidade || item.unidade === newUnit || item.unidade === "todas");
  const activeProduct = resolveProduct();
  const activeUnit = activeProduct?.unidade?.trim();
  const quantityPlaceholder = activeUnit ? `Quantidade (${activeUnit})` : "Quantidade";

  function NeedCard({ need }: { need: Need }) {
    const disabled = busy === need.id;
    const draft = responseDrafts[need.id] ?? need.observacao ?? "";

    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-950"><span className="text-blue-700">{need.codigo}</span> {need.descricao}</p>
            <p className="mt-1 text-xs text-slate-500">{unitLabel(need.unidade)} · {need.vendedor} · Qtd. {need.quantidade || "—"}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{label(need.status)}</span>
        </div>
        {need.notaVendedor && <p className="mt-3 text-sm text-slate-600">{need.notaVendedor}</p>}
        {need.observacao && <p className="mt-3 text-sm font-medium text-amber-700">{need.observacao}</p>}
        {need.status === "pedido_existente" && <p className="mt-3 text-sm">Pedido <strong>{need.numeroPedido}</strong> · previsão {need.previsaoEntrega || "não informada"}</p>}
        <p className="mt-3 text-xs text-slate-400">{date(need.criadoEm)}</p>
        {need.status !== "chegou" && isManager && (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Observação / resposta da necessidade</span>
              <textarea
                value={draft}
                onChange={(event) => setResponseDrafts((current) => ({ ...current, [need.id]: event.target.value }))}
                rows={3}
                placeholder="Registre aqui a resposta, orientação ou observação sobre esta necessidade."
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {["pendente", "observacao"].includes(need.status) && <button disabled={disabled} onClick={() => void post({ action: "em_compra", id: need.id }, need.id)} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Relação de compra</button>}
              {["pendente", "em_compra", "observacao"].includes(need.status) && <button disabled={disabled} onClick={() => void order(need)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Pedido feito</button>}
              {["pendente", "em_compra", "observacao"].includes(need.status) && <button disabled={disabled} onClick={() => void observe(need)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50">Salvar observação</button>}
              {need.status === "pedido_existente" && <button disabled={disabled} onClick={() => void arrived(need)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Produto chegou</button>}
            </div>
          </div>
        )}
      </article>
    );
  }

  function RequestForm() {
    return (
      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Consultar e solicitar produto</h2>
        <p className="mt-1 text-sm text-slate-500">Fluxo rápido: código + Enter, descrição + Enter, quantidade + Enter, observação + Enter, cliente aguardando + Enter e registrar.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <select value={newUnit} onChange={(event) => { setNewUnit(event.target.value as RequestUnit); setSeller(""); }} disabled={safeAllowedUnits.length === 1} className={input}>
            {safeAllowedUnits.map((item) => <option key={item} value={item}>{unitLabel(item)}</option>)}
          </select>
          <select value={seller} onChange={(event) => setSeller(event.target.value)} className={input}>
            <option value="">Selecione o vendedor</option>
            {sellerOptions.map((item) => <option key={`${item.nome}-${item.unidade}`} value={item.nome}>{item.nome}</option>)}
          </select>
          <div className="relative">
            <input ref={codeInputRef} value={codeSearch} onChange={(event) => { setCodeSearch(event.target.value); setSelected(""); }} onKeyDown={handleCodeKeyDown} inputMode="numeric" placeholder="Código do produto" className={input + " w-full"} />
            {codeResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-xl border bg-white shadow-lg">
                {codeResults.map((product) => <button key={product.codigo} onMouseDown={(event) => event.preventDefault()} onClick={() => selectProduct(product)} className="block w-full border-b px-4 py-3 text-left text-sm hover:bg-slate-50"><strong>{product.codigo}</strong> {product.descricao}</button>)}
              </div>
            )}
          </div>
          <div className="relative md:col-span-2 xl:col-span-3">
            <input ref={descriptionInputRef} value={descriptionSearch} onChange={(event) => { setDescriptionSearch(event.target.value); setSelected(""); }} onKeyDown={handleDescriptionKeyDown} placeholder="Descrição do produto" className={input + " w-full"} />
            {descriptionResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-xl border bg-white shadow-lg">
                {descriptionResults.map((product) => <button key={product.codigo} onMouseDown={(event) => event.preventDefault()} onClick={() => selectProduct(product)} className="block w-full border-b px-4 py-3 text-left text-sm hover:bg-slate-50"><strong>{product.codigo}</strong> {product.descricao}</button>)}
              </div>
            )}
          </div>
          <div>
            <input ref={quantityInputRef} value={quantity} onChange={(event) => setQuantity(event.target.value)} onKeyDown={handleQuantityKeyDown} placeholder={quantityPlaceholder} className={input + " w-full"} />
            {activeUnit && <p className="mt-1 text-xs font-semibold text-emerald-700">Unidade de medida: {activeUnit}</p>}
          </div>
          <input ref={noteInputRef} value={note} onChange={(event) => setNote(event.target.value)} onKeyDown={handleNoteKeyDown} placeholder="Observação" className={input + " md:col-span-2 xl:col-span-5"} />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm"><input ref={waitingInputRef} type="checkbox" checked={waiting} onChange={(event) => setWaiting(event.target.checked)} onKeyDown={handleWaitingKeyDown} /> Cliente aguardando</label>
        <button ref={registerButtonRef} onClick={() => void create()} disabled={busy === "geral"} className={primary + " mt-4"}>Registrar solicitação</button>
      </section>
    );
  }

  function TrackingSection() {
    return (
      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Acompanhamento</p>
            <h2 className="mt-1 text-xl font-semibold">Solicitações registradas</h2>
          </div>
          {isManager && <button onClick={() => void refresh()} className={secondary}>Atualizar</button>}
        </div>
        <div className="mt-4 space-y-3">
          {trackingNeeds.map((need) => <NeedCard key={need.id} need={need} />)}
          {!loading && !trackingNeeds.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhuma solicitação em acompanhamento.</p>}
          {loading && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Carregando solicitações...</p>}
        </div>
      </section>
    );
  }

  function UnitSwitch() {
    if (!isManager) return null;
    return (
      <section className="rounded-3xl border border-blue-100 bg-blue-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Visualização</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Trocar tela da loja</h2>
          </div>
          <div className="flex rounded-xl bg-white p-1 shadow-sm">
            {(["rio_claro", "araras", "todas"] as Unit[]).map((item) => (
              <button key={item} onClick={() => setUnit(item)} className={`rounded-lg px-4 py-2 text-xs font-semibold ${unit === item ? "bg-blue-700 text-white" : "text-slate-600"}`}>
                {item === "todas" ? "Todas" : unitLabel(item)}
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function NeedsSection() {
    return (
      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Necessidades do estoque</h2>
          {isManager && (
            <div className="flex rounded-xl bg-slate-100 p-1">
              {(["todas", "rio_claro", "araras"] as Unit[]).map((item) => <button key={item} onClick={() => setUnit(item)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${unit === item ? "bg-white shadow-sm" : "text-slate-500"}`}>{item === "todas" ? "Todas" : unitLabel(item)}</button>)}
            </div>
          )}
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <div>
            <h3 className="font-semibold">Em aberto</h3>
            <div className="mt-3 space-y-3">{openNeeds.map((need) => <NeedCard key={need.id} need={need} />)}{!loading && !openNeeds.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhuma necessidade em aberto.</p>}</div>
          </div>
          <div>
            <h3 className="font-semibold">A caminho</h3>
            <div className="mt-3 space-y-3">{onWay.map((need) => <NeedCard key={need.id} need={need} />)}{!loading && !onWay.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum produto a caminho.</p>}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="pb-10">
      {isManager && (
        <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Módulo Estoque</p>
            <h1 className="mt-2 text-3xl font-semibold">Estoque CT</h1>
            <p className="mt-3 text-sm text-slate-600">Uso direto no Portal Timoni, no computador ou celular.</p>
            <p className="mt-2 text-xs text-slate-500">As notificações aparecem quando o Portal estiver aberto neste aparelho e o navegador permitir avisos.</p>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button onClick={() => void refresh()} className={primary}>Atualizar informações</button>
            <button onClick={() => void requestNotifications()} className={secondary}>
              {notificationPermission === "granted" ? "Notificações ativadas" : "Ativar notificações"}
            </button>
            <a href={SHEET_URL} target="_blank" rel="noreferrer" className={secondary + " text-center"}>Abrir planilha</a>
          </div>
        </section>
      )}

      {error && <div className={isManager ? "mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800" : "rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"}>{error}</div>}
      {notice && <div className={isManager ? "mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800" : "rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"}>{notice}</div>}

      {!isManager ? (
        <div className="space-y-5">
          {NeedsSection()}
          {RequestForm()}
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {UnitSwitch()}
          {NeedsSection()}

          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {cards.map(([key, title]) => <article key={key} className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-3xl font-semibold">{loading ? "—" : summary.geral[key]}</p><p className="mt-2 text-sm text-slate-500">{title}</p></article>)}
          </section>

          {RequestForm()}

          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Finalizadas</h2>
            <div className="mt-3 space-y-3">{history.map((need) => <NeedCard key={need.id} need={need} />)}{!loading && !history.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum registro finalizado.</p>}</div>
          </section>
        </div>
      )}
    </div>
  );
}
