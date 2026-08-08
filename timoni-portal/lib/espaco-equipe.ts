import { google } from "googleapis";
import { getAccessTokenFromRefreshToken } from "@/lib/google-calendar";

export const ESPACO_EQUIPE_SPREADSHEET_ID = "1aLAj_PJv8MjDpzKkGqyLnALCiP_uJfe9udj9_Yk0X-I";
export const ESPACO_EQUIPE_SHEET = "Registros";

export type TeamMessage = {
  date: string;
  unit: string;
  employee: string;
  message: string;
  status: string;
  note: string;
};

async function getSheetsClient() {
  const accessToken = await getAccessTokenFromRefreshToken();
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

export async function appendTeamMessage(input: {
  unit: string;
  employee: string;
  message: string;
}) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: ESPACO_EQUIPE_SPREADSHEET_ID,
    range: `${ESPACO_EQUIPE_SHEET}!A:F`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[new Date().toISOString(), input.unit, input.employee, input.message, "Novo", ""]],
    },
  });
}

export async function listTeamMessages(): Promise<TeamMessage[]> {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: ESPACO_EQUIPE_SPREADSHEET_ID,
    range: `${ESPACO_EQUIPE_SHEET}!A2:F500`,
  });

  return (response.data.values ?? [])
    .map((row) => ({
      date: row[0] ?? "",
      unit: row[1] ?? "",
      employee: row[2] ?? "",
      message: row[3] ?? "",
      status: row[4] ?? "Novo",
      note: row[5] ?? "",
    }))
    .filter((item) => item.employee && item.message)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}
