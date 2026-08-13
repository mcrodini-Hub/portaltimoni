import { google } from "googleapis";
import { getAccessTokenFromRefreshToken } from "@/lib/google-calendar";
import { COMUNICADOS_SPREADSHEET_ID } from "@/lib/comunicados";

export type MeetingUnit = "Araras" | "Rio Claro";
export type MeetingStatus = "agendada" | "concluida";

export type Meeting = {
  id: string;
  unit: MeetingUnit;
  date: string;
  time: string;
  secondDate: string;
  secondTime: string;
  frequency: string;
  leaders: string;
  pautaUrl: string;
  ataUrl: string;
  slidesUrl: string;
  status: MeetingStatus;
  createdAt: string;
  updatedAt: string;
};

const SHEET = "Reunioes";
const HEADERS = [
  "id", "unit", "date", "time", "secondDate", "secondTime", "frequency",
  "leaders", "pautaUrl", "ataUrl", "slidesUrl", "status", "createdAt", "updatedAt",
];

const SEED: Omit<Meeting, "id" | "createdAt" | "updatedAt">[] = [
  {
    unit: "Araras",
    date: "2026-09-08",
    time: "07:40",
    secondDate: "2026-10-09",
    secondTime: "07:40",
    frequency: "Mensal",
    leaders: "Ciça e Marcelo",
    pautaUrl: "https://docs.google.com/document/d/1NoZASmMc-ptrqFy8zbvtGgCJjLJxX8GsORM-F4N799k",
    ataUrl: "https://docs.google.com/document/d/1S9dQlOGwFE8RwNnjw1PFy08DH9a6k1_9kugQEBgmxHQ",
    slidesUrl: "https://docs.google.com/presentation/d/1zN_tU03-tq8Y6Ewo4GasboPTjRHXnpjXB0bbSrjHaWI",
    status: "agendada",
  },
  {
    unit: "Rio Claro",
    date: "2026-08-08",
    time: "07:30",
    secondDate: "2026-09-03",
    secondTime: "07:30",
    frequency: "Mensal",
    leaders: "Ciça, Marcelo e Jeovana",
    pautaUrl: "https://docs.google.com/document/d/1qlgMtkqkg-LlS-LtdxDHYKcNXWbAbgWjARDtNRLHBe8",
    ataUrl: "https://docs.google.com/document/d/1rVOOEsR4dkqj51O8iRc14X5Iy2ywCEn0hxXz_jBKmyQ",
    slidesUrl: "https://docs.google.com/presentation/d/1VblTWAcgvrEdWBf5PMq97sr23NNdtT7vQg8Hmza_JPM",
    status: "agendada",
  },
];

async function sheetsClient(sessionAccessToken?: string) {
  const accessToken = sessionAccessToken || await getAccessTokenFromRefreshToken();
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

async function ensureSheet(accessToken: string) {
  const sheets = await sheetsClient(accessToken);
  const book = await sheets.spreadsheets.get({
    spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
    fields: "sheets.properties.title",
  });
  const exists = book.data.sheets?.some((sheet) => sheet.properties?.title === SHEET);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
      range: `${SHEET}!A1:N1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
  }
  return sheets;
}

function parseRows(rows: string[][]): Meeting[] {
  return rows.map((row) => ({
    id: row[0] || "",
    unit: (row[1] || "Araras") as MeetingUnit,
    date: row[2] || "",
    time: row[3] || "",
    secondDate: row[4] || "",
    secondTime: row[5] || "",
    frequency: row[6] || "Mensal",
    leaders: row[7] || "",
    pautaUrl: row[8] || "",
    ataUrl: row[9] || "",
    slidesUrl: row[10] || "",
    status: (row[11] || "agendada") as MeetingStatus,
    createdAt: row[12] || "",
    updatedAt: row[13] || "",
  })).filter((item) => item.id);
}

function valuesOf(item: Meeting) {
  return [
    item.id, item.unit, item.date, item.time, item.secondDate, item.secondTime,
    item.frequency, item.leaders, item.pautaUrl, item.ataUrl, item.slidesUrl,
    item.status, item.createdAt, item.updatedAt,
  ];
}

async function readRows(accessToken: string) {
  const sheets = await ensureSheet(accessToken);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
    range: `${SHEET}!A2:N500`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (response.data.values || []) as string[][];
}

async function seedIfEmpty(accessToken: string) {
  const rows = await readRows(accessToken);
  if (rows.length) return rows;
  const sheets = await sheetsClient(accessToken);
  const now = new Date().toISOString();
  const values = SEED.map((item, index) => valuesOf({
    ...item,
    id: `meeting-seed-${index + 1}`,
    createdAt: now,
    updatedAt: now,
  }));
  await sheets.spreadsheets.values.append({
    spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
    range: `${SHEET}!A:N`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
  return values as string[][];
}

export async function listMeetings(accessToken: string) {
  return parseRows(await seedIfEmpty(accessToken)).sort((a, b) => a.date.localeCompare(b.date));
}

export async function createMeeting(
  accessToken: string,
  input: Omit<Meeting, "id" | "createdAt" | "updatedAt" | "status">,
) {
  const sheets = await ensureSheet(accessToken);
  const now = new Date().toISOString();
  const item: Meeting = {
    ...input,
    id: `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: "agendada",
    createdAt: now,
    updatedAt: now,
  };
  await sheets.spreadsheets.values.append({
    spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
    range: `${SHEET}!A:N`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [valuesOf(item)] },
  });
  return item.id;
}

async function findRow(accessToken: string, id: string) {
  const rows = await readRows(accessToken);
  const index = rows.findIndex((row) => row[0] === id);
  return index < 0 ? null : index + 2;
}

export async function updateMeeting(accessToken: string, id: string, input: Partial<Meeting>) {
  const rowNumber = await findRow(accessToken, id);
  if (!rowNumber) throw new Error("Reunião não encontrada.");
  const current = (await listMeetings(accessToken)).find((item) => item.id === id);
  if (!current) throw new Error("Reunião não encontrada.");
  const sheets = await sheetsClient(accessToken);
  const updated: Meeting = { ...current, ...input, id, updatedAt: new Date().toISOString() };
  await sheets.spreadsheets.values.update({
    spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
    range: `${SHEET}!A${rowNumber}:N${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [valuesOf(updated)] },
  });
}

export async function deleteMeeting(accessToken: string, id: string) {
  const rowNumber = await findRow(accessToken, id);
  if (!rowNumber) throw new Error("Reunião não encontrada.");
  const sheets = await sheetsClient(accessToken);
  const book = await sheets.spreadsheets.get({
    spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
    fields: "sheets.properties",
  });
  const sheetId = book.data.sheets?.find((sheet) => sheet.properties?.title === SHEET)?.properties?.sheetId;
  if (sheetId === undefined) throw new Error("Aba de reuniões não encontrada.");
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber },
        },
      }],
    },
  });
}
