import { unreadStockIds } from "@/lib/stock-notice-reads";
import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { google, type sheets_v4 } from "googleapis";
import { NextResponse } from "next/server";
import { recordModuleUpdateSafely } from "@/lib/module-updates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPREADSHEET_ID = "1cESMTRx98e6AbY5vxPCcT7VrqYAbgH0xGUk87ybqHUo";
const NEED_COLUMNS = 15;

const STATUS = {
  PENDENTE: "pendente",
  EM_COMPRA: "em_compra",
  PEDIDO_EXISTENTE: "pedido_existente",
  OBSERVACAO: "observacao",
  CONSULTA: "consulta",
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

const fixedSellers: Seller[] = [
  { nome: "João", unidade: "rio_claro" },
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


function summarize(needs: Need[]) {
  const geral = emptyCounts();
  const porUnidade = { rio_claro: emptyCounts(), araras: emptyCounts() };
  for (const need of needs) {
    let field: keyof Counts | null = null;
    if (need.status === STATUS.PENDENTE || need.status === STATUS.OBSERVACAO || need.status === STATUS.CONSULTA) field = "emAberto";
    if (need.status === STATUS.EM_COMPRA) field = "aguardandoCompra";
    if (need.status === STATUS.PEDIDO_EXISTENTE) field = "aguardandoChegada";
    if (need.status === STATUS.CHEGOU) field = "finalizadas";
    if (!field) continue;
    geral[field] += 1;
    porUnidade[need.unidade][field] += 1;
  }
  return { geral, porUnidade };
}


async function getSheets() {
  const session = await auth();
  if (!session?.user?.email || !hasModuleAccess(session.user.email, "estoque", session.portalUser)) {
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
    ranges: ["Necessidades!A:O", "Produtos!A:C", "Vendedores!A:B"],
    valueRenderOption: "FORMATTED_VALUE",
  });
  const [needRange, productRange, sellerRange] = response.data.valueRanges ?? [];
  const needRows = (needRange?.values ?? []) as unknown[][];
  const productRows = (productRange?.values ?? []) as unknown[][];
  const sellerRows = (sellerRange?.values ?? []) as unknown[][];
  const necessidades = needRows.slice(1).filter((row) => value(row, 0)).map(rowToNeed);
  const produtos = rowsToProducts(productRows);
  const vendedores = rowsToSellers(sellerRows);
  return { necessidades, produtos, vendedores, summary: summarize(necessidades), needRows };
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
    const session = await auth();
    let unreadIds: string[] | null = null;
    try { unreadIds = await unreadStockIds(session?.user?.email || "", data.necessidades); }
    catch (error) { console.error("[stock-notifications]", error); }
    return NextResponse.json({
      unreadIds,
      ok: true,
      necessidades: data.necessidades,
      produtos: data.produtos,
      vendedores: data.vendedores,
      summary: data.summary,
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

async function recordStockUpdate(summary: string) {
  const session = await auth();
  await recordModuleUpdateSafely("estoque", session?.user?.email, summary);
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
          await recordStockUpdate(`Produto atualizado: ${produto.codigo} · ${produto.descricao}.`);
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
      await recordStockUpdate(`Nova solicitação: ${produto.codigo} · ${produto.descricao}.`);
      return NextResponse.json({ ok: true, id });
    }

    const id = String(body.id ?? "").trim();
    if (!id) throw new Error("Solicitação não identificada.");
    const rowIndex = data.needRows.slice(1).findIndex((row) => value(row, 0) === id);
    if (rowIndex < 0) throw new Error("Solicitação não encontrada.");
    const currentNeed = data.necessidades.find((item) => item.id === id);
    if (!currentNeed) throw new Error("Solicitação não encontrada.");
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

    if (action === "editar") {
      if (!(await canDeleteStockRecords())) throw new Error("Somente Ciça pode editar solicitações do Estoque.");
      const status = String(body.status ?? currentNeed.status);
      const statusChanged = status !== currentNeed.status;
      if (statusChanged && !([STATUS.PENDENTE, STATUS.EM_COMPRA, STATUS.PEDIDO_EXISTENTE] as string[]).includes(status)) throw new Error("Selecione uma etapa válida.");
      const quantidade = String(body.quantidade ?? currentNeed.quantidade).trim();
      const nota = String(body.nota ?? currentNeed.notaVendedor).trim();
      const observacao = String(body.observacao ?? currentNeed.observacao).trim();
      const numeroPedido = String(body.numeroPedido ?? currentNeed.numeroPedido).trim();
      const previsao = String(body.previsao ?? currentNeed.previsaoEntrega).trim();
      if (previsao && !/^\d{4}-\d{2}-\d{2}$/.test(previsao)) throw new Error("Informe uma previsão de entrega válida.");
      if (statusChanged && status === STATUS.PEDIDO_EXISTENTE && (!numeroPedido || !previsao)) throw new Error("Informe o pedido e a previsão para A caminho.");
      if (nota.length > 50000 || observacao.length > 50000) throw new Error("Observação muito longa.");
      await updateCells(sheets, [
        { range: `Necessidades!G${rowNumber}:I${rowNumber}`, values: [[numeroPedido, previsao, observacao]] },
        { range: `Necessidades!M${rowNumber}:N${rowNumber}`, values: [[quantidade, nota]] },
        ...(statusChanged ? [
          { range: `Necessidades!D${rowNumber}`, values: [[status]] },
          { range: `Necessidades!O${rowNumber}`, values: [[""]] },
        ] : []),
      ]);
      await recordStockUpdate(`Solicitação editada: ${currentNeed.codigo} · ${currentNeed.descricao}.`);
      return NextResponse.json({ ok: true });
    }

    if (action === "em_compra") {
      await updateCells(sheets, [
        { range: `Necessidades!D${rowNumber}`, values: [[STATUS.EM_COMPRA]] },
        { range: `Necessidades!F${rowNumber}`, values: [[now]] },
      ]);
      await recordStockUpdate("Solicitação encaminhada para compra.");
      return NextResponse.json({ ok: true });
    }
    if (action === "consulta") {
      const texto = String(body.texto ?? currentNeed.observacao).trim();
      if (!texto) throw new Error("Escreva a resposta da consulta.");
      await updateCells(sheets, [
        { range: `Necessidades!D${rowNumber}`, values: [[STATUS.CONSULTA]] },
        { range: `Necessidades!F${rowNumber}`, values: [[now]] },
        { range: `Necessidades!I${rowNumber}`, values: [[texto]] },
      ]);
      await recordStockUpdate(`Consulta registrada: ${currentNeed.codigo} · ${currentNeed.descricao}.`);
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
      await recordStockUpdate(`Pedido informado: ${numeroPedido}.`);
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
      await recordStockUpdate("Observação adicionada em uma solicitação.");
      return NextResponse.json({ ok: true });
    }
    if (action === "editar_observacao") {
      if (!(await canDeleteStockRecords())) throw new Error("Somente Ciça pode editar respostas do Estoque.");
      const texto = String(body.texto ?? "").trim();
      if (!texto) throw new Error("Escreva a resposta.");
      await updateCells(sheets, [
        { range: `Necessidades!F${rowNumber}`, values: [[now]] },
        { range: `Necessidades!I${rowNumber}`, values: [[texto]] },
      ]);
      await recordStockUpdate("Resposta editada em uma solicitação.");
      return NextResponse.json({ ok: true });
    }
    if (action === "resposta_vendedor") {
      const texto = String(body.texto ?? "").trim();
      if (!texto) throw new Error("Escreva a resposta.");
      if (texto.length > 1000) throw new Error("A resposta deve ter no máximo 1.000 caracteres.");
      const momento = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(now));
      const resposta = `Resposta de ${currentNeed.vendedor || "vendedor"} · ${momento}:\n${texto}`;
      const historico = currentNeed.observacao.trim();
      const observacao = historico ? `${historico}\n\n${resposta}` : resposta;
      const nextStatus = [STATUS.OBSERVACAO, STATUS.CONSULTA].includes(currentNeed.status as typeof STATUS.OBSERVACAO | typeof STATUS.CONSULTA)
        ? STATUS.CONSULTA
        : STATUS.PENDENTE;
      await updateCells(sheets, [
        { range: `Necessidades!D${rowNumber}`, values: [[nextStatus]] },
        { range: `Necessidades!F${rowNumber}`, values: [[now]] },
        { range: `Necessidades!I${rowNumber}`, values: [[observacao.slice(0, 50000)]] },
      ]);
      await recordStockUpdate(`Resposta do vendedor recebida: ${currentNeed.codigo} · ${currentNeed.descricao}.`);
      return NextResponse.json({ ok: true });
    }
    if (action === "reabrir") {
      if (!(await canDeleteStockRecords())) throw new Error("Somente Ciça pode reabrir solicitações do Estoque.");
      if (currentNeed.status !== STATUS.CHEGOU) throw new Error("Somente solicitações em Chegou podem ser reabertas.");
      await updateCells(sheets, [
        { range: `Necessidades!D${rowNumber}`, values: [[STATUS.PEDIDO_EXISTENTE]] },
        { range: `Necessidades!O${rowNumber}`, values: [[""]] },
      ]);
      await recordStockUpdate(`Solicitação reaberta para A caminho: ${currentNeed.codigo} · ${currentNeed.descricao}.`);
      return NextResponse.json({ ok: true });
    }

    if (action === "chegou") {
      await updateCells(sheets, [
        { range: `Necessidades!D${rowNumber}`, values: [[STATUS.CHEGOU]] },
        { range: `Necessidades!O${rowNumber}`, values: [[now]] },
      ]);
      await recordStockUpdate("Chegada de produto confirmada.");
      return NextResponse.json({ ok: true });
    }
    throw new Error("Ação desconhecida.");
  } catch (error) {
    return apiError(error);
  }
}

