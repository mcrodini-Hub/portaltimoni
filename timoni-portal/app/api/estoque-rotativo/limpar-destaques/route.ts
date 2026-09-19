import { google } from "googleapis";
import { NextResponse } from "next/server";
import { ROTATING_STOCK_CENTRAL, listExpiredHighlights, markHighlightsCleared } from "@/lib/rotating-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  try {
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
    if (!refreshToken) throw new Error("GOOGLE_REFRESH_TOKEN não configurado.");
    const oauth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    oauth.setCredentials({ refresh_token: refreshToken });
    const sheets = google.sheets({ version: "v4", auth: oauth });
    const expired = await listExpiredHighlights();
    if (!expired.length) return NextResponse.json({ ok: true, cleared: 0 });
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId, fields: "sheets.properties" });
    const sheetId = spreadsheet.data.sheets?.find((item) => item.properties?.title === ROTATING_STOCK_CENTRAL.sheetName)?.properties?.sheetId;
    if (sheetId === undefined || sheetId === null) throw new Error("Aba Produtos não encontrada.");
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
      requestBody: {
        requests: expired.map((item) => ({
          repeatCell: {
            range: { sheetId, startRowIndex: item.target_row - 1, endRowIndex: item.target_row, startColumnIndex: 3, endColumnIndex: 4 },
            cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 1, blue: 1 } } },
            fields: "userEnteredFormat.backgroundColor",
          },
        })),
      },
    });
    await markHighlightsCleared(expired.map((item) => item.id));
    return NextResponse.json({ ok: true, cleared: expired.length });
  } catch (error) {
    console.error("[estoque-rotativo][limpar-destaques]", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha na limpeza." }, { status: 500 });
  }
}
