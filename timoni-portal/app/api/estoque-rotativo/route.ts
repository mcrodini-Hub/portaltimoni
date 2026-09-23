import { createHash, randomUUID } from "node:crypto";
import { google, type sheets_v4 } from "googleapis";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasModuleAccess, normalizeEmail } from "@/lib/access-control";
import { createChatMessage, ensureConversation } from "@/lib/internal-chat";
import { recordModuleUpdateSafely } from "@/lib/module-updates";
import { getStoredTrelloCredentials, normalizeTrelloText, trelloFetch, TRELLO_BOARD_SHORT_LINK } from "@/lib/trello";
import {
  ROTATING_STOCK_CENTRAL,
  ROTATING_STOCK_EMAILS,
  acquireRotatingStockLock,
  attachSupplierToWaitingUpdates,
  createRotatingStockUpdate,
  deleteCompletedRotatingStockUpdate,
  finishConference,
  getRotatingStockUpdate,
  listConferenceItems,
  listExpiredHighlights,
  listRotatingStockData,
  markHighlightsCleared,
  resolveNotFoundItem,
  reopenRotatingStockUpdate,
  saveConference,
  saveSupplierMapping,
  type RotatingStockItem,
} from "@/lib/rotating-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANAGEMENT_EMAILS = new Set<string>([ROTATING_STOCK_EMAILS.cica, ROTATING_STOCK_EMAILS.marcelo]);

type TrelloList = { id: string; name: string; closed?: boolean };
type TrelloBoard = { lists?: TrelloList[] };
type TrelloCard = { id: string; name: string; closed?: boolean; dueComplete?: boolean };

function hasAllTokens(value: string, tokens: string[]) {
  const normalized = normalizeTrelloText(value);
  return tokens.every((token) => normalized.includes(token));
}

async function concludeRotatingStockCard(cardId: string, supplierName: string) {
  const credentials = await getStoredTrelloCredentials();
  if (!credentials) throw new Error("Trello ainda não configurado no Portal.");

  let resolvedCardId = cardId.trim();
  if (!resolvedCardId) {
    const board = await trelloFetch<TrelloBoard>(`/boards/${TRELLO_BOARD_SHORT_LINK}`, {
      credentials,
      params: { fields: "name", lists: "open", list_fields: "name,closed" },
    });
    const target = (board.lists || []).find(
      (list) => !list.closed && hasAllTokens(list.name, ["estoque", "rotativo", "lucas", "carol"]),
    );
    if (!target) throw new Error("Lista ESTOQUE ROTATIVO LUCAS/CAROL não encontrada no Trello.");
    const cards = await trelloFetch<TrelloCard[]>(`/lists/${target.id}/cards`, {
      credentials,
      params: { fields: "name,closed,dueComplete", filter: "all" },
    });
    const normalizedName = normalizeTrelloText(supplierName);
    resolvedCardId = cards.find((card) => normalizeTrelloText(card.name) === normalizedName)?.id || "";
  }
  if (!resolvedCardId) throw new Error(`Card do Trello não encontrado para ${supplierName}.`);

  await trelloFetch<TrelloCard>(`/cards/${encodeURIComponent(resolvedCardId)}`, {
    method: "PUT",
    credentials,
    params: { dueComplete: true, closed: false },
  });
}

function extractSpreadsheetId(value: string) {
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match?.[1]) return match[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(value.trim()) ? value.trim() : "";
}

function cleanCode(value: unknown) {
  return String(value ?? "").trim();
}

function integerStock(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  const normalized = text.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label}: estoque inválido.`);
  const integer = Math.trunc(number);
  if (!Number.isSafeInteger(integer)) throw new Error(`${label}: estoque fora do limite aceito.`);
  return integer;
}

function nullableStock(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  return text === "" ? null : integerStock(value, label);
}

function fingerprint(sourceRows: unknown[][], targetRows: unknown[][]) {
  return createHash("sha256").update(JSON.stringify({ sourceRows, targetRows })).digest("hex");
}

async function context() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email || !hasModuleAccess(email, "estoque-rotativo", session?.portalUser)) throw new Error("Acesso não autorizado ao Estoque Rotativo.");
  if (!session?.accessToken || session.error === "RefreshAccessTokenError") throw new Error("Sessão expirada. Saia e entre novamente no Portal.");
  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: session.accessToken });
  return { email, sheets: google.sheets({ version: "v4", auth: oauth }) };
}

function requireRole(email: string, role: "report" | "conference" | "manage") {
  const manager = MANAGEMENT_EMAILS.has(email);
  if (role === "report" && (manager || email === ROTATING_STOCK_EMAILS.lucas)) return;
  if (role === "conference" && (manager || email === ROTATING_STOCK_EMAILS.carolina)) return;
  if (role === "manage" && manager) return;
  throw new Error("Seu acesso não permite esta ação.");
}

function columnIndex(letter: string) {
  const normalized = letter.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) throw new Error(`Coluna inválida: ${letter}.`);
  let index = 0;
  for (const char of normalized) index = index * 26 + char.charCodeAt(0) - 64;
  return index - 1;
}

function columnLetter(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

async function readComparedRows(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  startRow: number,
  maxSourceColumn: number,
) {
  const [source, target] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A${startRow}:${columnLetter(maxSourceColumn)}`,
      valueRenderOption: "FORMATTED_VALUE",
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
      range: `${ROTATING_STOCK_CENTRAL.sheetName}!${ROTATING_STOCK_CENTRAL.range}`,
      valueRenderOption: "FORMATTED_VALUE",
    }),
  ]);
  return {
    sourceRows: (source.data.values || []) as unknown[][],
    targetRows: (target.data.values || []) as unknown[][],
  };
}

function normalizeMatch(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

function buildComparison(
  sourceRows: unknown[][],
  targetRows: unknown[][],
  startRow: number,
  codeColumn: number,
  descriptionColumn: number,
  stockColumn: number,
) {
  const targetByCode = new Map<string, { row: number; stock: number | null }>();
  const targetByDescription = new Map<string, { row: number; stock: number | null }>();
  const duplicateDescriptions = new Set<string>();

  for (let index = 0; index < targetRows.length; index += 1) {
    const code = cleanCode(targetRows[index]?.[0]);
    const description = normalizeMatch(targetRows[index]?.[1]);
    if (!code && !description) continue;
    const target = { row: index + 2, stock: nullableStock(targetRows[index]?.[2], `Base central, linha ${index + 2}`) };
    if (code) targetByCode.set(code, target);
    if (description) {
      if (targetByDescription.has(description)) duplicateDescriptions.add(description);
      else targetByDescription.set(description, target);
    }
  }
  for (const description of duplicateDescriptions) targetByDescription.delete(description);

  const sourceCodes = new Set<string>();
  const items: Omit<RotatingStockItem, "id" | "update_id" | "applied">[] = [];
  for (let index = 0; index < sourceRows.length; index += 1) {
    const row = sourceRows[index] || [];
    const code = cleanCode(row[codeColumn]);
    const description = String(row[descriptionColumn] ?? "").trim();
    const stockValue = row[stockColumn];
    if (!code && !description && String(stockValue ?? "").trim() === "") continue;
    if (!code && !description) throw new Error(`Linha ${startRow + index}: código e descrição vazios.`);
    if (code && sourceCodes.has(code)) throw new Error(`Código duplicado na planilha do fornecedor: ${code}.`);
    if (code) sourceCodes.add(code);
    const newStock = integerStock(stockValue, `Linha ${startRow + index}, código ${code || "sem código"}`);
    const target = (code ? targetByCode.get(code) : undefined) || targetByDescription.get(normalizeMatch(description));
    const situation = !target ? "nao_encontrado" : target.stock !== null && target.stock === newStock ? "sem_alteracao" : "encontrado";
    items.push({
      source_row: startRow + index,
      target_row: target?.row ?? null,
      code,
      description,
      old_stock: target?.stock ?? null,
      new_stock: newStock,
      situation,
    });
  }
  if (!items.length) throw new Error("A planilha não possui itens válidos a partir da linha informada.");
  return items;
}

async function centralSheetId(sheets: sheets_v4.Sheets) {
  const response = await sheets.spreadsheets.get({ spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId, fields: "sheets.properties" });
  const sheet = response.data.sheets?.find((item) => item.properties?.title === ROTATING_STOCK_CENTRAL.sheetName);
  if (sheet?.properties?.sheetId === undefined || sheet.properties.sheetId === null) throw new Error("Aba Produtos não encontrada na planilha central.");
  return sheet.properties.sheetId;
}

function rotatingStockFilterTitle(updateId: string, supplierName: string) {
  const shortId = updateId.replace(/-/g, "").slice(0, 8);
  const cleanSupplier = supplierName.replace(/[\r\n]+/g, " ").trim().slice(0, 45);
  return `Rotativo · ${cleanSupplier || "Atualização"} · ${shortId}`;
}

async function ensureRotatingStockFilterView(
  sheets: sheets_v4.Sheets,
  updateId: string,
  supplierName: string,
  targetRows: number[],
) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),filterViews(filterViewId,title))",
  });
  const sheet = metadata.data.sheets?.find((item) => item.properties?.title === ROTATING_STOCK_CENTRAL.sheetName);
  const sheetId = sheet?.properties?.sheetId;
  const rowCount = sheet?.properties?.gridProperties?.rowCount || 6401;
  const columnCount = Math.min(sheet?.properties?.gridProperties?.columnCount || 5, 5);
  if (sheetId === undefined || sheetId === null) throw new Error("Aba Produtos não encontrada na planilha central.");

  const title = rotatingStockFilterTitle(updateId, supplierName);
  const existing = sheet?.filterViews?.find((filterView) => filterView.title === title);
  if (existing?.filterViewId) return existing.filterViewId;

  const selectedRows = new Set(targetRows.filter((row) => Number.isInteger(row) && row >= 2 && row <= rowCount));
  if (!selectedRows.size) throw new Error("Esta atualização não possui itens encontrados na planilha central.");

  const valuesResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
    range: `${ROTATING_STOCK_CENTRAL.sheetName}!B2:C${rowCount}`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const values = (valuesResponse.data.values || []) as unknown[][];

  function filterSpec(valueOffset: number, sheetColumnIndex: number) {
    const selectedValues = new Set<string>();
    const occurrences = new Map<string, number[]>();

    for (let index = 0; index < values.length; index += 1) {
      const rowNumber = index + 2;
      const value = String(values[index]?.[valueOffset] ?? "").trim();
      const list = occurrences.get(value) || [];
      list.push(rowNumber);
      occurrences.set(value, list);
      if (selectedRows.has(rowNumber)) {
        if (!value) return null;
        selectedValues.add(value);
      }
    }

    for (const value of selectedValues) {
      const rows = occurrences.get(value) || [];
      if (rows.some((row) => !selectedRows.has(row))) return null;
    }

    const hiddenValues = new Set<string>();
    for (let index = 0; index < values.length; index += 1) {
      const rowNumber = index + 2;
      if (selectedRows.has(rowNumber)) continue;
      const value = String(values[index]?.[valueOffset] ?? "").trim();
      if (!selectedValues.has(value)) hiddenValues.add(value);
    }

    return {
      columnIndex: sheetColumnIndex,
      filterCriteria: { hiddenValues: Array.from(hiddenValues) },
    };
  }

  const spec = filterSpec(0, 1) || filterSpec(1, 2);
  if (!spec) throw new Error("Não foi possível criar um filtro exato para esta atualização.");

  const created = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
    requestBody: {
      requests: [{
        addFilterView: {
          filter: {
            title,
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: rowCount,
              startColumnIndex: 0,
              endColumnIndex: columnCount,
            },
            filterSpecs: [spec],
          },
        },
      }],
    },
  });

  const filterViewId = created.data.replies?.[0]?.addFilterView?.filter?.filterViewId;
  if (!filterViewId) throw new Error("O filtro da atualização não foi criado.");
  return filterViewId;
}

async function ensurePendingStatuses(sheets: sheets_v4.Sheets) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
    range: `${ROTATING_STOCK_CENTRAL.sheetName}!A2:B`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = (response.data.values || []) as unknown[][];
  const data: Array<{ range: string; values: string[][] }> = [];
  const validUpdated = /^atualizado em \d{2}\/\d{2}\/(?:\d{2}|\d{4})$/i;

  for (let index = 0; index < rows.length; index += 1) {
    const status = String(rows[index]?.[0] ?? "").trim();
    const code = String(rows[index]?.[1] ?? "").trim();
    if (!code) continue;
    if (status.toLocaleLowerCase("pt-BR") === "pendente" || validUpdated.test(status)) continue;
    data.push({
      range: `${ROTATING_STOCK_CENTRAL.sheetName}!A${index + 2}`,
      values: [["Pendente"]],
    });
  }

  if (data.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
      requestBody: { valueInputOption: "RAW", data },
    });
  }
}

function rotatingStockStatusDate() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

async function clearExpiredHighlights(sheets: sheets_v4.Sheets) {
  const expired = await listExpiredHighlights();
  if (!expired.length) return;
  const sheetId = await centralSheetId(sheets);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
    requestBody: {
      requests: expired.map((item) => ({
        repeatCell: {
          range: { sheetId, startRowIndex: item.target_row - 1, endRowIndex: item.target_row, startColumnIndex: 3, endColumnIndex: 4 },
          cell: { userEnteredFormat: { backgroundColor: { red: 0.812, green: 0.886, blue: 0.953 } } },
          fields: "userEnteredFormat.backgroundColor",
        },
      })),
    },
  });
  await markHighlightsCleared(expired.map((item) => item.id));
}

function apiError(error: unknown) {
  const raw = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
  const permission = /insufficient|permission|forbidden|403/i.test(raw);
  const unauthorized = /não autorizado|não permite/i.test(raw);
  const message = permission ? "Sem acesso à planilha. Confirme o compartilhamento e entre novamente no Portal." : raw;
  return NextResponse.json({ ok: false, error: message }, { status: unauthorized || permission ? 403 : 400 });
}

export async function GET(request: Request) {
  try {
    const { email, sheets } = await context();
    await clearExpiredHighlights(sheets);
    const searchParams = new URL(request.url).searchParams;
    const openUpdateId = searchParams.get("openUpdateId")?.trim() || "";
    if (openUpdateId) {
      const update = await getRotatingStockUpdate(openUpdateId);
      if (!update || update.status !== "atualizado") throw new Error("Atualização concluída não encontrada.");
      const items = await listConferenceItems(openUpdateId);
      const targetRows = items
        .filter((item) => item.situation !== "nao_encontrado" && item.target_row)
        .map((item) => item.target_row!)
        .filter((row, index, rows) => rows.indexOf(row) === index)
        .sort((a, b) => a - b);
      const filterViewId = await ensureRotatingStockFilterView(sheets, openUpdateId, update.supplier_name, targetRows);
      const url = `https://docs.google.com/spreadsheets/d/${ROTATING_STOCK_CENTRAL.spreadsheetId}/edit#gid=${await centralSheetId(sheets)}&fvid=${filterViewId}`;
      return NextResponse.redirect(url);
    }
    const spreadsheetReference = searchParams.get("spreadsheetReference")?.trim() || "";
    if (spreadsheetReference) {
      const spreadsheetId = extractSpreadsheetId(spreadsheetReference);
      if (!spreadsheetId) throw new Error("Link da planilha inválido.");
      const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
      const sheetNames = (metadata.data.sheets || []).map((item) => item.properties?.title).filter((title): title is string => Boolean(title));
      return NextResponse.json({ ok: true, sheetNames, singleSheetName: sheetNames.length === 1 ? sheetNames[0] : null }, { headers: { "Cache-Control": "no-store" } });
    }
    const id = searchParams.get("id");
    const data = await listRotatingStockData();
    return NextResponse.json({
      ok: true,
      ...data,
      items: id ? await listConferenceItems(id) : [],
      currentUpdate: id ? await getRotatingStockUpdate(id) : null,
      permissions: {
        canReport: MANAGEMENT_EMAILS.has(email) || email === ROTATING_STOCK_EMAILS.lucas,
        canConference: MANAGEMENT_EMAILS.has(email) || email === ROTATING_STOCK_EMAILS.carolina,
        canManage: MANAGEMENT_EMAILS.has(email),
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { email, sheets } = await context();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");

    if (action === "registrar") {
      requireRole(email, "report");
      const supplierName = String(body.supplierName || "").trim();
      const spreadsheetReference = String(body.spreadsheetReference || "").trim();
      const note = String(body.note || "").trim();
      const sourceSheetName = String(body.sourceSheetName || "").trim();
      const sourceCodeColumn = String(body.sourceCodeColumn || "").trim().toUpperCase();
      const sourceDescriptionColumn = String(body.sourceDescriptionColumn || "").trim().toUpperCase();
      const sourceStockColumn = String(body.sourceStockColumn || "").trim().toUpperCase();
      const sourceStartRow = Number(body.sourceStartRow);
      const trelloCardId = String(body.trelloCardId || "").trim();
      if (supplierName.length < 2) throw new Error("Informe o fornecedor ou grupo.");
      if (!spreadsheetReference) throw new Error("Informe o link da planilha.");
      if (!extractSpreadsheetId(spreadsheetReference)) throw new Error("Link da planilha inválido.");
      if (!sourceSheetName) throw new Error("Informe a aba da planilha.");
      for (const column of [sourceCodeColumn, sourceDescriptionColumn, sourceStockColumn]) {
        if (!/^[A-Z]+$/.test(column)) throw new Error("Informe colunas válidas para código, descrição e estoque.");
      }
      if (!Number.isInteger(sourceStartRow) || sourceStartRow < 1) throw new Error("Informe a linha inicial.");
      const id = randomUUID();
      await createRotatingStockUpdate({
        id,
        supplierId: null,
        supplierName,
        spreadsheetName: spreadsheetReference.startsWith("http") ? supplierName : spreadsheetReference,
        spreadsheetLink: spreadsheetReference.startsWith("http") ? spreadsheetReference : "",
        note,
        reportedBy: email,
        status: "aguardando_conferencia",
        sourceSheetName,
        sourceCodeColumn,
        sourceDescriptionColumn,
        sourceStockColumn,
        sourceStartRow,
        trelloCardId,
      });
      const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date());
      const conversation = await ensureConversation(ROTATING_STOCK_EMAILS.lucas, ROTATING_STOCK_EMAILS.carolina);
      await createChatMessage(conversation.id, ROTATING_STOCK_EMAILS.lucas, ROTATING_STOCK_EMAILS.carolina,
        `[Mensagem automática] ESTOQUE ROTATIVO\n\nNova relação de produtos disponível para atualização.\n\nPlanilha: ${spreadsheetReference}\nFornecedor: ${supplierName}\nInformado por: Lucas\nData: ${date}\n\nStatus: Aguardando conferência.\n\nPor favor, verificar no módulo Estoque Rotativo.`);
      await recordModuleUpdateSafely("estoque-rotativo", email, `Nova relação: ${supplierName}.`, `estoque-rotativo:${id}`);
      return NextResponse.json({ ok: true, id, needsMapping: false });
    }

    if (action === "salvar_mapeamento") {
      requireRole(email, "manage");
      const name = String(body.name || "").trim();
      const spreadsheetId = extractSpreadsheetId(String(body.spreadsheetId || ""));
      const sheetName = String(body.sheetName || "").trim();
      const dataRange = String(body.dataRange || "").trim().toUpperCase();
      const columns = [body.codeColumn, body.descriptionColumn, body.stockColumn].map((value) => Number(value));
      if (!name || !spreadsheetId || !sheetName || !/^[A-Z]+\d+:[A-Z]+\d+$/.test(dataRange)) throw new Error("Revise fornecedor, planilha, aba e intervalo.");
      if (columns.some((value) => !Number.isInteger(value) || value < 0)) throw new Error("As colunas devem ser índices inteiros iniciados em zero.");
      if (new Set(columns).size !== 3) throw new Error("Código, descrição e estoque devem usar colunas diferentes.");
      const id = await saveSupplierMapping({
        id: body.id ? String(body.id) : undefined,
        name, spreadsheetId, sheetName, dataRange,
        codeColumn: columns[0], descriptionColumn: columns[1], stockColumn: columns[2], actor: email,
      });
      await attachSupplierToWaitingUpdates(id, spreadsheetId, name);
      return NextResponse.json({ ok: true, id });
    }

    if (action === "editar_registro") {
      requireRole(email, "report");
      const id = String(body.id || "");
      const supplierName = String(body.supplierName || "").trim();
      const spreadsheetReference = String(body.spreadsheetReference || "").trim();
      const sourceSheetName = String(body.sourceSheetName || "").trim();
      const sourceCodeColumn = String(body.sourceCodeColumn || "").trim().toUpperCase();
      const sourceDescriptionColumn = String(body.sourceDescriptionColumn || "").trim().toUpperCase();
      const sourceStockColumn = String(body.sourceStockColumn || "").trim().toUpperCase();
      const sourceStartRow = Number(body.sourceStartRow);
      const note = String(body.note || "").trim();
      const trelloCardId = String(body.trelloCardId || "").trim();
      if (!id || !supplierName || !extractSpreadsheetId(spreadsheetReference) || !sourceSheetName) throw new Error("Complete todos os campos obrigatórios.");
      if (![sourceCodeColumn, sourceDescriptionColumn, sourceStockColumn].every((column) => /^[A-Z]+$/.test(column))) throw new Error("Revise as colunas.");
      if (!Number.isInteger(sourceStartRow) || sourceStartRow < 1) throw new Error("Revise a linha inicial.");
      await reopenRotatingStockUpdate({
        id, supplierName,
        spreadsheetName: supplierName,
        spreadsheetLink: spreadsheetReference,
        note, sourceSheetName, sourceCodeColumn, sourceDescriptionColumn, sourceStockColumn, sourceStartRow, trelloCardId,
      });
      return NextResponse.json({ ok: true, id });
    }

    if (action === "resolver_nao_encontrado") {
      requireRole(email, "conference");
      const itemId = String(body.itemId || "");
      if (!itemId || !(await resolveNotFoundItem(itemId, email))) throw new Error("Pendência não encontrada ou já resolvida.");
      return NextResponse.json({ ok: true });
    }

    const id = String(body.id || "");
    if (!id) throw new Error("Atualização não identificada.");
    const update = await getRotatingStockUpdate(id);
    if (!update) throw new Error("Atualização não encontrada.");
    const sourceSpreadsheetId = extractSpreadsheetId(update.spreadsheet_link);
    if (!sourceSpreadsheetId || !update.source_sheet_name || !update.source_code_column || !update.source_description_column || !update.source_stock_column) {
      throw new Error("Reabra para editar e complete aba, colunas e linha inicial.");
    }
    const codeColumn = columnIndex(update.source_code_column);
    const descriptionColumn = columnIndex(update.source_description_column);
    const stockColumn = columnIndex(update.source_stock_column);
    const maxSourceColumn = Math.max(codeColumn, descriptionColumn, stockColumn);

    if (action === "conferir") {
      requireRole(email, "conference");
      if (update.status === "atualizado") throw new Error("Esta atualização já foi concluída.");
      await ensurePendingStatuses(sheets);
      if (!(await acquireRotatingStockLock(id, email))) throw new Error("Esta conferência está aberta por outro usuário. Tente novamente em alguns minutos.");
      const { sourceRows, targetRows } = await readComparedRows(sheets, sourceSpreadsheetId, update.source_sheet_name, update.source_start_row, maxSourceColumn);
      const items = buildComparison(sourceRows, targetRows, update.source_start_row, codeColumn, descriptionColumn, stockColumn);
      await saveConference(id, email, fingerprint(sourceRows, targetRows), items);
      return NextResponse.json({ ok: true, items, fingerprint: fingerprint(sourceRows, targetRows) });
    }

    if (action === "atualizar") {
      requireRole(email, "conference");
      if (update.status !== "em_conferencia" || update.locked_by !== email) throw new Error("Reabra a conferência antes de atualizar.");
      const storedItems = await listConferenceItems(id);
      const matched = storedItems.filter((item) => item.situation !== "nao_encontrado" && item.target_row);
      const selected = storedItems.filter((item) => item.situation === "encontrado" && item.target_row);
      const { sourceRows, targetRows } = await readComparedRows(sheets, sourceSpreadsheetId, update.source_sheet_name, update.source_start_row, maxSourceColumn);
      if (fingerprint(sourceRows, targetRows) !== update.fingerprint) throw new Error("A planilha mudou durante a conferência. Recarregue a comparação e confirme novamente.");

      const statusText = `Atualizado ${rotatingStockStatusDate()}`;
      const valueUpdates = [
        ...matched.map((item) => ({
          range: `${ROTATING_STOCK_CENTRAL.sheetName}!A${item.target_row}`,
          values: [[statusText]],
        })),
        ...selected.map((item) => ({
          range: `${ROTATING_STOCK_CENTRAL.sheetName}!D${item.target_row}`,
          values: [[item.new_stock]],
        })),
      ];

      if (valueUpdates.length) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
          requestBody: {
            valueInputOption: "RAW",
            data: valueUpdates,
          },
        });
      }

      if (matched.length) {
        const sheetId = await centralSheetId(sheets);
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
          requestBody: {
            requests: matched.map((item) => ({
              repeatCell: {
                range: { sheetId, startRowIndex: item.target_row! - 1, endRowIndex: item.target_row!, startColumnIndex: 3, endColumnIndex: 4 },
                cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.949, blue: 0.8 } } },
                fields: "userEnteredFormat.backgroundColor",
              },
            })),
          },
        });
      }

      await concludeRotatingStockCard(update.trello_card_id || "", update.supplier_name);
      await finishConference(id, email, selected.map((item) => item.id), matched.map((item) => item.target_row!));
      await recordModuleUpdateSafely(
        "estoque-rotativo",
        email,
        `${matched.length} itens conferidos; ${selected.length} estoques alterados; card concluído: ${update.supplier_name}.`,
        `estoque-rotativo:done:${id}`,
      );
      return NextResponse.json({ ok: true, updated: selected.length, reviewed: matched.length, status: statusText });
    }

    if (action === "excluir_atualizacao") {
      requireRole(email, "manage");
      const id = String(body.id || "").trim();
      if (!id) throw new Error("Atualização não identificada.");
      const removed = await deleteCompletedRotatingStockUpdate(id);
      if (!removed) throw new Error("Somente rotativos concluídos podem ser excluídos.");
      await recordModuleUpdateSafely(
        "estoque-rotativo",
        email,
        "Rotativo concluído removido do histórico.",
        `estoque-rotativo:delete:${id}`,
      );
      return NextResponse.json({ ok: true });
    }

    throw new Error("Ação inválida.");
  } catch (error) {
    return apiError(error);
  }
}
