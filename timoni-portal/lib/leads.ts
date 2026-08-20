import { google } from "googleapis";
import { getAccessTokenFromRefreshToken } from "@/lib/google-calendar";

export const LEADS_SPREADSHEET_ID = "1P2O9xhqyu7bMTythhZEPDEY8NYhh99hUthFQOaRCyK8";
export const LEADS_SHEET = "FOLLOW UP";
export const PROSPECTS_SOURCE_SHEET = "A PROSPECTAR";
export const PROSPECTS_PORTAL_SHEET = "PROSPECTAR PORTAL";

export type Lead = {
  row: number;
  cliente: string;
  segmento: string;
  contato: string;
  canal: string;
  ultimoContato: string;
  proximoContato: string;
  observacoes: string;
  status: "atrasado" | "hoje" | "proximo" | "sem-data";
};

export type Prospect = {
  id: string;
  cliente: string;
  segmento: string;
  cidade: string;
  contato: string;
  canal: string;
  oportunidade: string;
  observacoes: string;
  origem: "historico" | "portal";
};

async function sheetsClient() {
  const accessToken = await getAccessTokenFromRefreshToken();
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

function parseDate(value: string) {
  const clean = value.trim().replace(/^[a-zá-ú]{3}\.,\s*/i, "");
  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    date.setHours(0, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const match = clean.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) return null;
  const yearRaw = match[3];
  const year = !yearRaw ? new Date().getFullYear() : Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw);
  const date = new Date(year, Number(match[2]) - 1, Number(match[1]));
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function leadStatus(value: string): Lead["status"] {
  const date = parseDate(value);
  if (!date) return "sem-data";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() < today.getTime()) return "atrasado";
  if (date.getTime() === today.getTime()) return "hoje";
  return "proximo";
}

async function ensureProspectsPortalSheet() {
  const sheets = await sheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: LEADS_SPREADSHEET_ID, fields: "sheets.properties.title" });
  const exists = (meta.data.sheets ?? []).some((sheet) => sheet.properties?.title === PROSPECTS_PORTAL_SHEET);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: LEADS_SPREADSHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title: PROSPECTS_PORTAL_SHEET } } }] } });
    await sheets.spreadsheets.values.update({
      spreadsheetId: LEADS_SPREADSHEET_ID,
      range: `'${PROSPECTS_PORTAL_SHEET}'!A1:G1`,
      valueInputOption: "RAW",
      requestBody: { values: [["Empresa", "Segmento", "Cidade/Região", "Contato", "Telefone/E-mail", "Produto/Oportunidade", "Observações"]] },
    });
  }
  return sheets;
}

export async function listLeads(): Promise<Lead[]> {
  const sheets = await sheetsClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: LEADS_SPREADSHEET_ID, range: `'${LEADS_SHEET}'!A2:G1000`, valueRenderOption: "FORMATTED_VALUE" });
  return (response.data.values ?? []).map((r, index) => ({
    row: index + 2,
    cliente: String(r[0] ?? "").trim(), segmento: String(r[1] ?? "").trim(), contato: String(r[2] ?? "").trim(), canal: String(r[3] ?? "").trim(),
    ultimoContato: String(r[4] ?? "").trim(), proximoContato: String(r[5] ?? "").trim(), observacoes: String(r[6] ?? "").trim(), status: leadStatus(String(r[5] ?? "")),
  })).filter((lead) => lead.cliente).sort((a, b) => {
    const weight = { atrasado: 0, hoje: 1, "sem-data": 2, proximo: 3 } as const;
    return weight[a.status] - weight[b.status] || a.cliente.localeCompare(b.cliente, "pt-BR");
  });
}

export async function listProspects(): Promise<Prospect[]> {
  const sheets = await ensureProspectsPortalSheet();
  const [historico, portal] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: LEADS_SPREADSHEET_ID, range: `'${PROSPECTS_SOURCE_SHEET}'!A2:D1000`, valueRenderOption: "FORMATTED_VALUE" }),
    sheets.spreadsheets.values.get({ spreadsheetId: LEADS_SPREADSHEET_ID, range: `'${PROSPECTS_PORTAL_SHEET}'!A2:G1000`, valueRenderOption: "FORMATTED_VALUE" }),
  ]);
  const antigo: Prospect[] = (historico.data.values ?? []).map((r, i) => ({ id: `h-${i + 2}`, cliente: String(r[1] ?? "").trim(), segmento: "", cidade: "", contato: "", canal: "", oportunidade: "Reativação", observacoes: `Código ${String(r[0] ?? "").trim()} · Vendas ${String(r[2] ?? "").trim()} · Último faturamento ${String(r[3] ?? "").trim()}`, origem: "historico" as const })).filter((x) => x.cliente);
  const novos: Prospect[] = (portal.data.values ?? []).map((r, i) => ({ id: `p-${i + 2}`, cliente: String(r[0] ?? "").trim(), segmento: String(r[1] ?? "").trim(), cidade: String(r[2] ?? "").trim(), contato: String(r[3] ?? "").trim(), canal: String(r[4] ?? "").trim(), oportunidade: String(r[5] ?? "").trim(), observacoes: String(r[6] ?? "").trim(), origem: "portal" as const })).filter((x) => x.cliente);
  return [...novos, ...antigo];
}

async function assertNotDuplicate(cliente: string) {
  const target = cliente.trim().toLocaleLowerCase("pt-BR");
  const [leads, prospects] = await Promise.all([listLeads(), listProspects()]);
  if (leads.some((x) => x.cliente.toLocaleLowerCase("pt-BR") === target) || prospects.some((x) => x.cliente.toLocaleLowerCase("pt-BR") === target)) throw new Error("Esta empresa já existe no Leads ou em A Prospectar.");
}

export async function addLead(input: { cliente:string; segmento:string; contato:string; canal:string; proximoContato:string; observacoes:string }) {
  if (!input.cliente.trim()) throw new Error("Informe a empresa.");
  if (!input.proximoContato.trim()) throw new Error("Informe a data do próximo contato.");
  await assertNotDuplicate(input.cliente);
  const sheets = await sheetsClient();
  await sheets.spreadsheets.values.append({ spreadsheetId: LEADS_SPREADSHEET_ID, range: `'${LEADS_SHEET}'!A:G`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [[input.cliente, input.segmento, input.contato, input.canal, "", input.proximoContato, input.observacoes]] } });
}

export async function addProspect(input: { cliente:string; segmento:string; cidade:string; contato:string; canal:string; oportunidade:string; observacoes:string }) {
  if (!input.cliente.trim()) throw new Error("Informe a empresa.");
  await assertNotDuplicate(input.cliente);
  const sheets = await ensureProspectsPortalSheet();
  await sheets.spreadsheets.values.append({ spreadsheetId: LEADS_SPREADSHEET_ID, range: `'${PROSPECTS_PORTAL_SHEET}'!A:G`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [[input.cliente, input.segmento, input.cidade, input.contato, input.canal, input.oportunidade, input.observacoes]] } });
}

export async function updateLeadFollowUp(input: { row: number; ultimoContato: string; proximoContato: string; observacoes: string }) {
  if (!Number.isInteger(input.row) || input.row < 2 || input.row > 1000) throw new Error("Linha inválida");
  const sheets = await sheetsClient();
  await sheets.spreadsheets.values.update({ spreadsheetId: LEADS_SPREADSHEET_ID, range: `'${LEADS_SHEET}'!E${input.row}:G${input.row}`, valueInputOption: "USER_ENTERED", requestBody: { values: [[input.ultimoContato, input.proximoContato, input.observacoes]] } });
}
