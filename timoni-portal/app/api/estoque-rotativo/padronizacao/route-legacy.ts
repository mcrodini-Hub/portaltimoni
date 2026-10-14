import { google, type sheets_v4 } from "googleapis";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasModuleAccess, normalizeEmail } from "@/lib/access-control";
import { deleteSupplierStandardization, ROTATING_STOCK_EMAILS } from "@/lib/rotating-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANAGEMENT_EMAILS = new Set<string>([ROTATING_STOCK_EMAILS.cica, ROTATING_STOCK_EMAILS.marcelo]);
const BACKUP_PREFIX = "BKP_ROTATIVO_";

function backupTitle(sheetName: string) {
  const sanitized = sheetName.replace(/[\\/?*\[\]:]/g, " ").trim();
  return `${BACKUP_PREFIX}${sanitized}`.slice(0, 100);
}

function hasValue(value: unknown) {
  return String(value ?? "").trim() !== "";
}

function isRotatingStockUpdate(value: unknown) {
  return /^(?:Estoque\s+)?Rotativo atualizado em\s+/i.test(String(value ?? "").trim());
}

function normalizeLabel(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function context() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email || !hasModuleAccess(email, "estoque-rotativo", session?.portalUser)) throw new Error("Acesso não autorizado ao Rotativo.");
  if (!MANAGEMENT_EMAILS.has(email)) throw new Error("Seu acesso não permite esta ação.");
  if (!session?.accessToken || session.error === "RefreshAccessTokenError") throw new Error("Sessão expirada. Saia e entre novamente no Portal.");
  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: session.accessToken });
  return { sheets: google.sheets({ version: "v4", auth: oauth }) };
}

async function spreadsheetSheets(sheets: sheets_v4.Sheets, spreadsheetId: string) {
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,index,hidden,gridProperties)",
  });
  return response.data.sheets || [];
}

async function createBackup(sheets: sheets_v4.Sheets, spreadsheetId: string, sheetName: string) {
  const available = await spreadsheetSheets(sheets, spreadsheetId);
  const source = available.find((sheet) => sheet.properties?.title === sheetName);
  const sourceId = source?.properties?.sheetId;
  if (sourceId === undefined || sourceId === null) throw new Error("A aba selecionada não foi encontrada.");

  const title = backupTitle(sheetName);
  const existing = available.find((sheet) => sheet.properties?.title === title);
  if (existing) return;

  const duplicated = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        duplicateSheet: {
          sourceSheetId: sourceId,
          insertSheetIndex: Math.max(0, Number(source?.properties?.index || 0) + 1),
          newSheetName: title,
        },
      }],
    },
  });
  const backupId = duplicated.data.replies?.[0]?.duplicateSheet?.properties?.sheetId;
  if (backupId === undefined || backupId === null) throw new Error("Não foi possível criar o ponto de restauração da planilha.");

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        updateSheetProperties: {
          properties: { sheetId: backupId, hidden: true },
          fields: "hidden",
        },
      }],
    },
  });
}

async function setA1Overflow(sheets: sheets_v4.Sheets, spreadsheetId: string, sheetName: string) {
  const available = await spreadsheetSheets(sheets, spreadsheetId);
  const sheet = available.find((item) => item.properties?.title === sheetName);
  const backup = available.find((item) => item.properties?.title === backupTitle(sheetName));
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) throw new Error("A aba selecionada não foi encontrada.");

  const rowCount = Math.max(5, sheet?.properties?.gridProperties?.rowCount || 1000);
  const columnCount = Math.max(6, sheet?.properties?.gridProperties?.columnCount || 26);
  const quotedSheet = `'${sheetName.replace(/'/g, "''")}'`;

  const current = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quotedSheet}!A1:Z20`,
    valueRenderOption: "FORMULA",
  });
  const currentValues = current.data.values || [];

  let standardizedLabel: unknown = currentValues
    .flat()
    .find((value) => /^Padronizada em\s+/i.test(String(value ?? "").trim())) || "";
  let rotatingLabel: unknown = currentValues
    .flat()
    .find((value) => isRotatingStockUpdate(value)) || "";
  let responsible: unknown = currentValues[3]?.[2] || currentValues[2]?.[3] || "";
  let originalDate: unknown = currentValues[3]?.[3] || "";

  if (backup?.properties?.title) {
    const quotedBackup = `'${backup.properties.title.replace(/'/g, "''")}'`;
    const original = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${quotedBackup}!A1:Z25`,
      valueRenderOption: "FORMULA",
    });
    const originalValues = original.data.values || [];

    const backupStandardized = originalValues
      .flat()
      .find((value) => /^Padronizada em\s+/i.test(String(value ?? "").trim()));
    const backupRotating = originalValues
      .flat()
      .find((value) => isRotatingStockUpdate(value));
    if (!hasValue(standardizedLabel) && hasValue(backupStandardized)) standardizedLabel = backupStandardized;
    if (!hasValue(rotatingLabel) && hasValue(backupRotating)) rotatingLabel = backupRotating;

    for (const row of originalValues) {
      const normalized = (row || []).map(normalizeLabel);
      const employeeIndex = normalized.findIndex((value) => value.includes("funcionario"));
      if (employeeIndex < 0) continue;
      const dateIndex = normalized.findIndex((value, index) => index > employeeIndex && value === "data");
      const names = (row || [])
        .slice(employeeIndex + 1, dateIndex >= 0 ? dateIndex : undefined)
        .filter((value) => hasValue(value));
      if (names.length) responsible = names.map((value) => String(value).trim()).join(" / ");
      if (dateIndex >= 0) {
        originalDate = (row || [])
          .slice(dateIndex + 1)
          .find((value) => hasValue(value)) || originalDate;
      }
      break;
    }
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: `${quotedSheet}!A2`, values: [[standardizedLabel]] },
        { range: `${quotedSheet}!A3`, values: [[rotatingLabel]] },
        { range: `${quotedSheet}!C4`, values: [[String(responsible || "").toLocaleUpperCase("pt-BR")]] },
        { range: `${quotedSheet}!D4`, values: [[originalDate]] },
        { range: `${quotedSheet}!C1`, values: [[""]] },
        { range: `${quotedSheet}!C2`, values: [[""]] },
        { range: `${quotedSheet}!D3`, values: [[""]] },
      ],
    },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
            cell: { userEnteredFormat: { wrapStrategy: "OVERFLOW_CELL" } },
            fields: "userEnteredFormat.wrapStrategy",
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 1 },
            cell: { userEnteredFormat: {
              backgroundColor: { red: 0.82, green: 0.9, blue: 1 },
              textFormat: { fontFamily: "Calibri", fontSize: 12, bold: true, foregroundColor: { red: 0, green: 0, blue: 0 } },
              horizontalAlignment: "LEFT",
              verticalAlignment: "MIDDLE",
              wrapStrategy: "OVERFLOW_CELL",
            } },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 1 },
            cell: { userEnteredFormat: {
              backgroundColor: { red: 1, green: 0.949, blue: 0.8 },
              textFormat: { fontFamily: "Calibri", fontSize: 10, bold: true, foregroundColor: { red: 0, green: 0, blue: 0 } },
              horizontalAlignment: "LEFT",
              verticalAlignment: "MIDDLE",
              wrapStrategy: "OVERFLOW_CELL",
            } },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 2, endColumnIndex: 3 },
            cell: { userEnteredFormat: {
              textFormat: { fontFamily: "Calibri", fontSize: 12, bold: true, foregroundColor: { red: 0.831, green: 0.047, blue: 0.051 } },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
            } },
            fields: "userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)",
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 3, endColumnIndex: 4 },
            cell: { userEnteredFormat: {
              textFormat: { fontFamily: "Calibri", fontSize: 12, bold: true, foregroundColor: { red: 0.831, green: 0.047, blue: 0.051 } },
              numberFormat: { type: "DATE", pattern: "dd/mm/yy" },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
            } },
            fields: "userEnteredFormat(textFormat,numberFormat,horizontalAlignment,verticalAlignment)",
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 4, endRowIndex: rowCount, startColumnIndex: 5, endColumnIndex: columnCount },
            cell: { userEnteredFormat: { numberFormat: { type: "TEXT", pattern: "@" } } },
            fields: "userEnteredFormat.numberFormat",
          },
        },
      ],
    },
  });
}

async function discardBackup(sheets: sheets_v4.Sheets, spreadsheetId: string, sheetName: string) {
  const available = await spreadsheetSheets(sheets, spreadsheetId);
  const backup = available.find((sheet) => sheet.properties?.title === backupTitle(sheetName));
  const backupId = backup?.properties?.sheetId;
  if (backupId === undefined || backupId === null) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ deleteSheet: { sheetId: backupId } }] },
  });
}

async function restoreBackup(sheets: sheets_v4.Sheets, spreadsheetId: string, sheetName: string) {
  const available = await spreadsheetSheets(sheets, spreadsheetId);
  const source = available.find((sheet) => sheet.properties?.title === sheetName);
  const backup = available.find((sheet) => sheet.properties?.title === backupTitle(sheetName));
  const sourceId = source?.properties?.sheetId;
  const backupId = backup?.properties?.sheetId;
  if (sourceId === undefined || sourceId === null) throw new Error("A aba padronizada não foi encontrada.");
  if (backupId === undefined || backupId === null) return false;

  const temporaryTitle = `TMP_ROTATIVO_${Date.now()}`.slice(0, 100);
  const originalIndex = Number(source?.properties?.index || 0);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId: sourceId, title: temporaryTitle },
            fields: "title",
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId: backupId, title: sheetName, hidden: false, index: originalIndex },
            fields: "title,hidden,index",
          },
        },
        { deleteSheet: { sheetId: sourceId } },
      ],
    },
  });
  return true;
}

function apiError(error: unknown) {
  const raw = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
  const permission = /insufficient|permission|forbidden|403/i.test(raw);
  const unauthorized = /não autorizado|não permite/i.test(raw);
  const message = permission ? "Sem acesso à planilha. Confirme o compartilhamento e entre novamente no Portal." : raw;
  return NextResponse.json({ ok: false, error: message }, { status: unauthorized || permission ? 403 : 400 });
}

export async function POST(request: Request) {
  try {
    const { sheets } = await context();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    const spreadsheetId = String(body.spreadsheetId || "").trim();
    const sheetName = String(body.sheetName || "").trim();
    if (!spreadsheetId || !sheetName) throw new Error("Planilha e aba são obrigatórias.");

    if (action === "criar_backup") {
      await createBackup(sheets, spreadsheetId, sheetName);
      return NextResponse.json({ ok: true });
    }
    if (action === "ajustar_a1") {
      await setA1Overflow(sheets, spreadsheetId, sheetName);
      return NextResponse.json({ ok: true });
    }
    if (action === "descartar_backup") {
      await discardBackup(sheets, spreadsheetId, sheetName);
      return NextResponse.json({ ok: true });
    }
    if (action === "reverter") {
      const restored = await restoreBackup(sheets, spreadsheetId, sheetName);
      await deleteSupplierStandardization(spreadsheetId, sheetName);
      return NextResponse.json({ ok: true, restored });
    }
    throw new Error("Ação de padronização inválida.");
  } catch (error) {
    return apiError(error);
  }
}
