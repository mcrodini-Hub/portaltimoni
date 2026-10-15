import { applyOfficialRotativoModel } from "@/lib/rotativo-official-model";
import { withStandardizationLock } from "@/lib/rotativo-standardization-lock";
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
  return withStandardizationLock(spreadsheetId, () => applyOfficialRotativoModel(sheets, spreadsheetId, sheetName));
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

    if (action === "testar_em_copia") {
      // Native Sheets copy needs only the existing spreadsheets scope.
      // No Drive permission expansion, supplier registration or source writes.
      const source = await sheets.spreadsheets.get({ spreadsheetId, fields: "properties(title),sheets.properties(sheetId,title)" });
      const sourceSheetId = source.data.sheets?.find(s => s.properties?.title === sheetName)?.properties?.sheetId;
      if (sourceSheetId == null) throw new Error("A aba selecionada não foi encontrada.");
      const created = await sheets.spreadsheets.create({ requestBody: { properties: { title: `TESTE ROTATIVO — ${source.data.properties?.title || sheetName}` }, sheets: [{ properties: { title: "PREPARANDO_TESTE" } }] } });
      const copyId = created.data.spreadsheetId;
      if (!copyId) throw new Error("Não foi possível criar a planilha de teste.");
      const copyUrl = created.data.spreadsheetUrl;
      try {
        const copied = await sheets.spreadsheets.sheets.copyTo({ spreadsheetId, sheetId: sourceSheetId, requestBody: { destinationSpreadsheetId: copyId } });
        const copiedSheetId = copied.data.sheetId;
        if (copiedSheetId == null) throw new Error("A cópia da aba não foi confirmada.");
        const placeholderId = created.data.sheets?.[0]?.properties?.sheetId;
        await sheets.spreadsheets.batchUpdate({ spreadsheetId: copyId, requestBody: { requests: [
          { updateSheetProperties: { properties: { sheetId: copiedSheetId, title: sheetName }, fields: "title" } },
          ...(placeholderId != null ? [{ deleteSheet: { sheetId: placeholderId } }] : []),
        ] } });
        await withStandardizationLock(copyId, () => createBackup(sheets, copyId, sheetName));
        const result = await setA1Overflow(sheets, copyId, sheetName);
        return NextResponse.json({ ok: true, ...result, spreadsheetId: copyId, spreadsheetUrl: copyUrl, sheetName });
      } catch (cause) {
        throw new Error(`${cause instanceof Error ? cause.message : "Falha no teste."} A original não foi alterada. Cópia de teste: ${copyUrl || copyId}`);
      }
    }

    if (action === "criar_backup") {
      await withStandardizationLock(spreadsheetId, () => createBackup(sheets, spreadsheetId, sheetName));
      return NextResponse.json({ ok: true });
    }
    if (action === "ajustar_a1") {
      const result = await setA1Overflow(sheets, spreadsheetId, sheetName);
      return NextResponse.json({ ok: true, ...result });
    }
    if (action === "descartar_backup") {
      // Keep the restore point after approval; backup deletion is no longer implicit.
      return NextResponse.json({ ok: true });
    }
    if (action === "reverter") {
      const restored = await withStandardizationLock(spreadsheetId, () => restoreBackup(sheets, spreadsheetId, sheetName));
      await deleteSupplierStandardization(spreadsheetId, sheetName);
      return NextResponse.json({ ok: true, restored });
    }
    throw new Error("Ação de padronização inválida.");
  } catch (error) {
    return apiError(error);
  }
}


