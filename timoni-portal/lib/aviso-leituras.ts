import { google } from "googleapis";

export const AVISO_LEITURAS_SPREADSHEET_ID = "1QblFB50pOJdXJB_t7lH_JtHllpI4EK5isG1-T_RYHso";
const LEITURAS_SHEET = "Leituras";
const FUNCIONARIOS_SHEET = "Funcionarios";
const DEFAULT_CONFIRMATION_PIN = "0000";

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
  input: { avisoId: string; employee: string; unit: string; portalEmail: string; title: string; pin: string },
) {
  const rows = await employeeRows(accessToken);
  const employeeRow = rows.find((row) => row[0] === input.employee && row[1] === input.unit && (row[4] || "Sim").toLowerCase() !== "não");
  if (!employeeRow) throw new Error("Funcionário não encontrado.");
  if (input.pin !== DEFAULT_CONFIRMATION_PIN) {
    throw new Error("Senha incorreta.");
  }

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
