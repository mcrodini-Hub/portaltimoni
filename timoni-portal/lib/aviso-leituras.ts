import { google } from "googleapis";
import { AVISO_LEITURAS_SPREADSHEET_ID } from "@/lib/portal-data-constants";

export { AVISO_LEITURAS_SPREADSHEET_ID } from "@/lib/portal-data-constants";
const LEITURAS_SHEET = "Leituras";
const FUNCIONARIOS_SHEET = "Funcionarios";

export type AvisoLeitura = {
  avisoId: string;
  employee: string;
  unit: string;
  portalEmail: string;
  readAt: string;
  title: string;
};

export type FuncionarioAviso = {
  employee: string;
  unit: string;
  pinConfigured: boolean;
};

function sheetsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

async function employeeRows(accessToken: string) {
  const sheets = sheetsClient(accessToken);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: AVISO_LEITURAS_SPREADSHEET_ID,
    range: `${FUNCIONARIOS_SHEET}!A2:E200`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (response.data.values ?? []) as string[][];
}

export async function listFuncionariosAvisos(accessToken: string): Promise<FuncionarioAviso[]> {
  return (await employeeRows(accessToken))
    .filter((row) => row[0] && row[1] && (row[4] || "Sim").toLowerCase() !== "não")
    .map((row) => ({ employee: row[0], unit: row[1], pinConfigured: true }));
}

export async function listAvisoLeituras(accessToken: string): Promise<AvisoLeitura[]> {
  const sheets = sheetsClient(accessToken);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: AVISO_LEITURAS_SPREADSHEET_ID,
    range: `${LEITURAS_SHEET}!A2:F2000`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return ((response.data.values ?? []) as string[][])
    .map((row) => ({
      avisoId: row[0] ?? "",
      employee: row[1] ?? "",
      unit: row[2] ?? "",
      portalEmail: row[3] ?? "",
      readAt: row[4] ?? "",
      title: row[5] ?? "",
    }))
    .filter((item) => item.avisoId && item.employee && item.readAt)
    .sort((a, b) => Date.parse(b.readAt) - Date.parse(a.readAt));
}

export async function registerAvisoLeitura(
  accessToken: string,
  input: { avisoId: string; employee: string; unit: string; portalEmail: string; title: string },
) {
  const current = await listAvisoLeituras(accessToken);
  if (current.some((item) => item.avisoId === input.avisoId && item.employee === input.employee && item.unit === input.unit)) {
    return { alreadyRegistered: true };
  }

  const sheets = sheetsClient(accessToken);
  await sheets.spreadsheets.values.append({
    spreadsheetId: AVISO_LEITURAS_SPREADSHEET_ID,
    range: `${LEITURAS_SHEET}!A:F`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[input.avisoId, input.employee, input.unit, input.portalEmail, new Date().toISOString(), input.title]],
    },
  });
  return { alreadyRegistered: false };
}

export async function replaceAvisoLeituras(accessToken: string, reads: AvisoLeitura[]) {
  const sheets = sheetsClient(accessToken);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: AVISO_LEITURAS_SPREADSHEET_ID,
    range: `${LEITURAS_SHEET}!A2:F2000`,
  });
  if (!reads.length) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: AVISO_LEITURAS_SPREADSHEET_ID,
    range: `${LEITURAS_SHEET}!A2`,
    valueInputOption: "RAW",
    requestBody: {
      values: reads.map((item) => [item.avisoId, item.employee, item.unit, item.portalEmail, item.readAt, item.title]),
    },
  });
}
