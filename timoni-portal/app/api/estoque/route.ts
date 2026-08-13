import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { normalizeTrelloText, trelloFetch, TRELLO_BOARD_SHORT_LINK } from "@/lib/trello";
import { google, type sheets_v4 } from "googleapis";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPREADSHEET_ID = "1cESMTRx98e6AbY5vxPCcT7VrqYAbgH0xGUk87ybqHUo";
const NEED_COLUMNS = 15;
const RECEIVED_VISIBLE_DAYS = 15;
const SENT_ORDERS_CACHE_RANGE = "Necessidades!Q:W";
const SENT_ORDERS_CACHE_HEADER = ["id", "nome", "enviadoEm", "previsaoEntrega", "recebidoEm", "unidade", "situacao"];

const STATUS = {
  PENDENTE: "pendente",
  EM_COMPRA: "em_compra",
  PEDIDO_EXISTENTE: "pedido_existente",
  OBSERVACAO: "observacao",
  CHEGOU: "chegou",
} as const;

type Need = {
  id: string;
  codigo: string;
  descricao: string;
  status: string;
  criadoEm: string;
  respondidoEm: string;
  numeroPedido: string;
  previsaoEntrega: string;
  observacao: string;
  clienteAguardando: boolean;
  unidade: "rio_claro" | "araras";
  vendedor: string;
  quantidade: string;
  notaVendedor: string;
  chegouEm: string;
};

type Product = { codigo: string; descricao: string; unidade: string };
type Seller = { nome: string; unidade: string };
type Counts = { emAberto: number; aguardandoCompra: number; aguardandoChegada: number; finalizadas: number };
type SentOrder = {
  id: string;
  nome: string;
  enviadoEm: string;
  previsaoEntrega: string;
  recebidoEm: string;
  unidade: "rio_claro" | "araras";
  situacao: "enviado" | "recebido";
};
type TrelloList = { id: string; name: string; closed?: boolean };
type TrelloBoard = { lists?: TrelloList[] };
type TrelloCard = {
  id: string;
  name: string;
  start?: string | null;
  due?: string | null;
  dateLastActivity?: string | null;
  closed?: boolean;
};
type SentTarget = {
  list: TrelloList;
  unidade: "rio_claro" | "araras";
  situacao: "enviado" | "recebido";
};

const fixedSellers: Seller[] = [
  { nome: "Ciça", unidade: "araras" },
  { nome: "Marcelo", unidade: "araras" },
];

function emptyCounts(): Counts {
  return { emAberto: 0, aguardandoCompra: 0, aguardandoChegada: 0, finalizadas: 0 };
}

function value(row: unknown[], index: number) {
  const current = row[index];
  return current === null || current === undefined ? "" : String(current);
}

function parseBool(input: unknown) {
  if (input === true) return true;
  return ["1", "true", "sim", "verdadeiro"].includes(String(input ?? "").trim().toLowerCase());
}

function rowToNeed(row: unknown[]): Need {
  return {
    id: value(row, 0), codigo: value(row, 1), descricao: value(row, 2), status: value(row, 3) || STATUS.PENDENTE,
    criadoEm: value(row, 4), respondidoEm: value(row, 5), numeroPedido: value(row, 6), previsaoEntrega: value(row, 7),
    observacao: value(row, 8), clienteAguardando: parseBool(row[9]), unidade: value(row, 10) === "araras" ? "araras" : "rio_claro",
    vendedor: value(row, 11), quantidade: value(row, 12), notaVendedor: value(row, 13), chegouEm: value(row, 14),
  };
}

function rowsToProducts(rows: unknown[][]): Product[] {
  return rows.slice(1).map((row) => ({ codigo: value(row, 0), descricao: value(row, 1), unidade: value(row, 2) })).filter((item) => item.codigo || item.descricao);
}

function rowsToSellers(rows: unknown[][]): Seller[] {
  const sellers = rows.slice(1).map((row) => ({ nome: value(row, 0), unidade: value(row, 1).toLowerCase() })).filter((item) => item.nome);
  const seen = new Set(sellers.map((seller) => `${seller.nome.trim().toLowerCase()}-${seller.unidade.trim().toLowerCase()}`));

  for (const seller of fixedSellers) {
    const key = `${seller.nome.trim().toLowerCase()}-${seller.unidade.trim().toLowerCase()}`;
    if (!seen.has(key)) sellers.push(seller);
  }

  return sellers;
}

function rowsToCachedOrders(rows: unknown[][]): SentOrder[] {
  return rows
    .slice(1)
    .map((row) => ({
      id: value(row, 0),
      nome: value(row, 1),
      enviadoEm: value(row, 2),
      previsaoEntrega: value(row, 3),
      recebidoEm: value(row, 4),
      unidade: value(row, 5) === "araras" ? "araras" as const : "rio_claro" as const,
      situacao: value(row, 6) === "recebido" ? "recebido" as const : "enviado" as const,
    }))
    .filter((order) => Boolean(order.id && order.nome && order.enviadoEm && order.previsaoEntrega))
    .filter((order) => order.situacao === "enviado" || isWithinReceivedWindow(order.recebidoEm));
}

function summarize(needs: Need[]) {
  const geral = emptyCounts();
  const porUnidade = { rio_claro: emptyCounts(), araras: emptyCounts() };
  for (const need of needs) {
    let field: keyof Counts | null = null;
    if (need.status === STATUS.PENDENTE || need.status === STATUS.OBSERVACAO) field = "emAberto";
    if (need.status === STATUS.EM_COMPRA) field = "aguardandoCompra";
    if (need.status === STATUS.PEDIDO_EXISTENTE) field = "aguardandoChegada";
    if (need.status === STATUS.CHEGOU) field = "finalizadas";
    if (!field) continue;
    geral[field] += 1;
    porUnidade[need.unidade][field] += 1;
  }
  return { geral, porUnidade };
}

function hasAllTokens(value: string, tokens: string[]) {
  const normalized = normalizeTrelloText(value);
  return tokens.every((token) => normalized.includes(token));
}

function isWithinReceivedWindow(value: string) {
  if (!value) return false;
  const receivedAt = new Date(value).getTime();
  if (Number.isNaN(receivedAt)) return false;
  const limit = RECEIVED_VISIBLE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - receivedAt <= limit;
}

function dedupeOrders(orders: SentOrder[]) {
  const unique = new Map<string, SentOrder>();
  const prioritized = [...orders].sort((a, b) => (a.situacao === "recebido" ? -1 : 1) - (b.situacao === "recebido" ? -1 : 1));
  for (const order of prioritized) {
    const key = `${normalizeTrelloText(order.nome)}|${order.unidade}`;
    if (!unique.has(key)) unique.set(key, order);
  }
  return [...unique.values()];
}

function sortOrders(orders: SentOrder[]) {
  return dedupeOrders(orders).sort((a, b) => {
    const aTime = new Date(a.previsaoEntrega).getTime();
    const bTime = new Date(b.previsaoEntrega).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

async function readSentOrders(): Promise<SentOrder[]> {
  const board = await trelloFetch<TrelloBoard>(`/boards/${TRELLO_BOARD_SHORT_LINK}`, {
    params: { fields: "name", lists: "open", list_fields: "name,closed" },
  });
  const lists = (board.lists || []).filter((list) => !list.closed);
  const targets: SentTarget[] = [];

  for (const list of lists) {
    const normalized = normalizeTrelloText(list.name || "");
    const isRio = normalized.includes("rio claro");
    const isAraras = normalized.includes("araras");
    const isSent = hasAllTokens(normalized, ["pedido", "enviado"]);
    const isReceived = hasAllTokens(normalized, ["pedido", "compra", "recebido"]);

    if (isSent && isRio) targets.push({ list, unidade: "rio_claro", situacao: "enviado" });
    else if (isSent && isAraras) targets.push({ list, unidade: "araras", situacao: "enviado" });
    else if (isReceived && isRio) targets.push({ list, unidade: "rio_claro", situacao: "recebido" });
    else if (isReceived && isAraras) targets.push({ list, unidade: "araras", situacao: "recebido" });
  }

  const groups = await Promise.all(
    targets.map(async ({ list, unidade, situacao }) => {
      const cards = await trelloFetch<TrelloCard[]>(`/lists/${encodeURIComponent(list.id)}/cards`, {
        params: { fields: "name,start,due,dateLastActivity,closed" },
      });
      return (cards || [])
        .filter((card) => !card.closed)
        .map((card) => ({
          id: card.id,
          nome: card.name,
          enviadoEm: card.start || "",
          previsaoEntrega: card.due || "",
          recebidoEm: situacao === "recebido" ? card.dateLastActivity || "" : "",
          unidade,
          situacao,
        } satisfies SentOrder))
        .filter((order) => Boolean(order.enviadoEm && order.previsaoEntrega))
        .filter((order) => order.situacao === "enviado" || isWithinReceivedWindow(order.recebidoEm));
    }),
  );

  return sortOrders(groups.flat());
}

async function getSheets() {
  const session = await auth();
  if (!session?.user?.email || !hasModuleAccess(session.user.email, "estoque")) {
    throw new Error("Acesso não autorizado ao módulo Estoque.");
  }
  if (!session.accessToken || session.error === "RefreshAccessTokenError") {
    throw new Error("Sessão expirada. Saia e entre novamente no Portal.");
  }
  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: session.accessToken });
  return google.sheets({ version: "v4", auth: oauth });
}

async function canDeleteStockRecords() {
  const session = await auth();
  return session?.user?.email?.trim().toLowerCase() === "mcrodini@gmail.com";
}

async function readAll(sheets: sheets_v4.Sheets) {
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges: ["Necessidades!A:O", "Produtos!A:C", "Vendedores!A:B", SENT_ORDERS_CACHE_RANGE],
    valueRenderOption: "FORMATTED_VALUE",
  });
  const [needRange, productRange, sellerRange, sentOrdersCacheRange] = response.data.valueRanges ?? [];
  const needRows = (needRange?.values ?? []) as unknown[][];
  const productRows = (productRange?.values ?? []) as unknown[][];
  const sellerRows = (sellerRange?.values ?? []) as unknown[][];
  const cacheRows = (sentOrdersCacheRange?.values ?? []) as unknown[][];
  const necessidades = needRows.slice(1).filter((row) => value(row, 0)).map(rowToNeed);
  const produtos = rowsToProducts(productRows);
  const vendedores = rowsToSellers(sellerRows);
  const cachedOrders = sortOrders(rowsToCachedOrders(cacheRows));
  return { necessidades, produtos, vendedores, summary: summarize(necessidades), needRows, cachedOrders };
}

async function writeSentOrdersCache(sheets: sheets_v4.Sheets, orders: SentOrder[]) {
  const values = [
    SENT_ORDERS_CACHE_HEADER,
    ...orders.map((order) => [
      order.id,
      order.nome,
      order.enviadoEm,
      order.previsaoEntrega,
      order.recebidoEm,
      order.unidade,
      order.situacao,
    ]),
  ];
  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: SENT_ORDERS_CACHE_RANGE });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Necessidades!Q1",
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha ao acessar o Estoque.";
  const unauthorized = /não autorizado/i.test(message);
  const needsNewConsent = /insufficient|permission|scope|forbidden|403/i.test(message);
  return NextResponse.json(
    { ok: false, error: needsNewConsent ? "Autorize o acesso à planilha: saia do Portal e entre novamente." : message },
    { status: unauthorized ? 403 : needsNewConsent ? 403 : 400 },
  );
}

export async function GET() {
  try {
    const sheets = await getSheets();
    const data = await readAll(sheets);
    let pedidosEnviados = data.cachedOrders;
    try {
      const trelloOrders = await readSentOrders();
      pedidosEnviados = trelloOrders;
      await writeSentOrdersCache(sheets, trelloOrders);
    } catch {
      pedidosEnviados = data.cachedOrders;
    }
    return NextResponse.json({
      ok: true,
      necessidades: data.necessidades,
      produtos: data.produtos,
      vendedores: data.vendedores,
      summary: data.summary,
      pedidosEnviados,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

async function updateCells(sheets: sheets_v4.Sheets, data: Array<{ range: string; values: unknown[][] }>) {
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { valueInputOption: "RAW", data } });
}

function normalizeUnit(input: unknown): "rio_claro" | "araras" {
  return input === "araras" ? "araras" : "rio_claro";
}

export async function POST(request: Request) {
  try {
    const sheets = await getSheets();
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const data = await readAll(sheets);

    if (action === "criar") {
      const codigo = String(body.codigo ?? "").trim();
      const unidade = normalizeUnit(body.unidade);
      const vendedor = String(body.vendedor ?? "").trim();
      const quantidade = String(body.quantidade ?? "").trim();
      const nota = String(body.nota ?? "").trim();
      const cliente = Boolean(body.clienteAguardando);
      if (!codigo) throw new Error("Selecione um produto.");
      if (!vendedor) throw new Error("Selecione o vendedor.");

      const produto = data.produtos.find((item) => item.codigo === codigo);
      if (!produto) throw new Error(`Produto ${codigo} não encontrado.`);
      const existing = data.necessidades.find((item) => item.codigo === codigo && item.unidade === unidade && item.status !== STATUS.CHEGOU);
      if (existing) {
        if (cliente && !existing.clienteAguardando) {
          const index = data.needRows.slice(1).findIndex((row) => value(row, 0) === existing.id);
          if (index >= 0) await updateCells(sheets, [{ range: `Necessidades!J${index + 2}`, values: [[true]] }]);
        }
        return NextResponse.json({ ok: true, existing: true, id: existing.id });
      }

      const now = new Date().toISOString();
      const id = `nec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const row = [id, produto.codigo, produto.descricao, STATUS.PENDENTE, now, "", "", "", "", cliente, unidade, vendedor, quantidade, nota, ""];
      if (row.length !== NEED_COLUMNS) throw new Error("Estrutura da necessidade inválida.");
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Necessidades!A:O",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [row] },
      });
      return NextResponse.json({ ok: true, id });
    }

    const id = String(body.id ?? "").trim();
    if (!id) throw new Error("Solicitação não identificada.");
    const rowIndex = data.needRows.slice(1).findIndex((row) => value(row, 0) === id);
    if (rowIndex < 0) throw new Error("Solicitação não encontrada.");
    const rowNumber = rowIndex + 2;
    const now = new Date().toISOString();

    if (action === "excluir") {
      if (!(await canDeleteStockRecords())) throw new Error("Somente Ciça pode excluir registros do Estoque.");
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
      const sheet = spreadsheet.data.sheets?.find((item) => item.properties?.title === "Necessidades");
      const sheetId = sheet?.properties?.sheetId;
      if (sheetId === null || sheetId === undefined) throw new Error("Aba Necessidades não encontrada.");
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber },
            },
          }],
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "em_compra") {
      await updateCells(sheets, [
        { range: `Necessidades!D${rowNumber}`, values: [[STATUS.EM_COMPRA]] },
        { range: `Necessidades!F${rowNumber}`, values: [[now]] },
      ]);
      return NextResponse.json({ ok: true });
    }
    if (action === "pedido") {
      const numeroPedido = String(body.numeroPedido ?? "").trim();
      const previsao = String(body.previsao ?? "").trim();
      if (!numeroPedido || !previsao) throw new Error("Informe o pedido e a previsão de entrega.");
      await updateCells(sheets, [
        { range: `Necessidades!D${rowNumber}`, values: [[STATUS.PEDIDO_EXISTENTE]] },
        { range: `Necessidades!F${rowNumber}`, values: [[now]] },
        { range: `Necessidades!G${rowNumber}`, values: [[numeroPedido]] },
        { range: `Necessidades!H${rowNumber}`, values: [[previsao]] },
      ]);
      return NextResponse.json({ ok: true });
    }
    if (action === "observacao") {
      const texto = String(body.texto ?? "").trim();
      if (!texto) throw new Error("Escreva a resposta.");
      await updateCells(sheets, [
        { range: `Necessidades!D${rowNumber}`, values: [[STATUS.OBSERVACAO]] },
        { range: `Necessidades!F${rowNumber}`, values: [[now]] },
        { range: `Necessidades!I${rowNumber}`, values: [[texto]] },
      ]);
      return NextResponse.json({ ok: true });
    }
    if (action === "chegou") {
      await updateCells(sheets, [
        { range: `Necessidades!D${rowNumber}`, values: [[STATUS.CHEGOU]] },
        { range: `Necessidades!O${rowNumber}`, values: [[now]] },
      ]);
      return NextResponse.json({ ok: true });
    }
    throw new Error("Ação desconhecida.");
  } catch (error) {
    return apiError(error);
  }
}
