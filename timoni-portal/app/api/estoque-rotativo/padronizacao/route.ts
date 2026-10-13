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
  return /^Rotativo atualizado em\s+/i.test(String(value ?? "").trim());
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
  const quotedBackup = backup?.properties?.title
    ? `'${backup.properties.title.replace(/'/g, "''")}'`
    : "";

  let restoreC2: unknown = "";
  let restoreD4: unknown = "";

  if (quotedBackup) {
    const [current, original] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${quotedSheet}!C2:E4`,
        valueRenderOption: "FORMULA",
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${quotedBackup}!C2:E4`,
        valueRenderOption: "FORMULA",
      }),
    ]);

    const currentValues = current.data.values || [];
    const originalValues = original.data.values || [];
    const currentC2 = currentValues[0]?.[0];
    const currentD4 = currentValues[2]?.[1];
    const currentE4 = currentValues[2]?.[2];
    const originalC2 = originalValues[0]?.[0];
    const originalD4 = originalValues[2]?.[1];
    const originalE4 = originalValues[2]?.[2];

    if (!hasValue(currentC2) && isRotatingStockUpdate(originalC2)) restoreC2 = originalC2;
    if (!hasValue(currentD4)) {
      restoreD4 = hasValue(currentE4)
        ? currentE4
        : hasValue(originalD4)
          ? originalD4
          : hasValue(originalE4)
            ? originalE4
            : "";
    }
  }

  const restoreData: Array<{ range: string; values: unknown[][] }> = [];
  if (hasValue(restoreC2)) restoreData.push({ range: `${quotedSheet}!C2`, values: [[restoreC2]] });
  if (hasValue(restoreD4)) restoreData.push({ range: `${quotedSheet}!D4`, values: [[restoreD4]] });
  if (restoreData.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: restoreData },
    });
  }

  const requests: sheets_v4.Schema$Request[] = [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
        cell: { userEnteredFormat: { wrapStrategy: "OVERFLOW_CELL" } },
        fields: "userEnteredFormat.wrapStrategy",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 4, endRowIndex: rowCount, startColumnIndex: 5, endColumnIndex: columnCount },
        cell: { userEnteredFormat: { numberFormat: { type: "TEXT", pattern: "@" } } },
        fields: "userEnteredFormat.numberFormat",
      },
    },
  ];

  if (hasValue(restoreC2)) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 2, endColumnIndex: 3 },
        cell: { userEnteredFormat: {
          backgroundColor: { red: 0.82, green: 0.95, blue: 0.84 },
          textFormat: {
            fontFamily: "Calibri",
            fontSize: 12,
            bold: false,
            foregroundColor: { red: 0, green: 0, blue: 0 },
          },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
          wrapStrategy: "WRAP",
        } },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
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
