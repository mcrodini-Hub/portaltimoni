import { neon } from "@neondatabase/serverless";
import { google } from "googleapis";
import { AVISO_LEITURAS_SPREADSHEET_ID } from "@/lib/portal-data-constants";

export { AVISO_LEITURAS_SPREADSHEET_ID } from "@/lib/portal-data-constants";
const LEITURAS_SHEET = "Leituras";
const FUNCIONARIOS_SHEET = "Funcionarios";
const MIGRATION_KEY = "aviso_leituras_google_v1";

export type AvisoLeitura = { avisoId: string; employee: string; unit: string; portalEmail: string; readAt: string; title: string };
export type FuncionarioAviso = { employee: string; unit: string; pinConfigured: boolean };
type LeituraRow = { aviso_id: string; employee: string; unit: string; portal_email: string; read_at: Date | string; title: string };

let database: ReturnType<typeof neon> | null = null;
let schemaReady: Promise<void> | null = null;

function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL não configurada no servidor.");
  if (!database) database = neon(databaseUrl);
  return database;
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getDatabase();
      await sql`
        CREATE TABLE IF NOT EXISTS portal_notice_reads (
          id BIGSERIAL PRIMARY KEY,
          aviso_id TEXT NOT NULL,
          employee TEXT NOT NULL,
          unit TEXT NOT NULL,
          portal_email TEXT NOT NULL DEFAULT '',
          read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          title TEXT NOT NULL DEFAULT '',
          UNIQUE (aviso_id, employee, unit)
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS portal_notice_reads_date_idx ON portal_notice_reads (read_at DESC)`;
      await sql`
        CREATE TABLE IF NOT EXISTS portal_data_migrations (
          key TEXT PRIMARY KEY,
          completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

function sheetsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

async function legacyEmployeeRows(accessToken: string) {
  const response = await sheetsClient(accessToken).spreadsheets.values.get({ spreadsheetId: AVISO_LEITURAS_SPREADSHEET_ID, range: `${FUNCIONARIOS_SHEET}!A2:E200`, valueRenderOption: "FORMATTED_VALUE" });
  return (response.data.values ?? []) as string[][];
}

async function legacyReadRows(accessToken: string) {
  const response = await sheetsClient(accessToken).spreadsheets.values.get({ spreadsheetId: AVISO_LEITURAS_SPREADSHEET_ID, range: `${LEITURAS_SHEET}!A2:F2000`, valueRenderOption: "FORMATTED_VALUE" });
  return (response.data.values ?? []) as string[][];
}

function parseLegacyReads(rows: string[][]): AvisoLeitura[] {
  return rows.map((row) => ({ avisoId: row[0] ?? "", employee: row[1] ?? "", unit: row[2] ?? "", portalEmail: row[3] ?? "", readAt: row[4] ?? "", title: row[5] ?? "" }))
    .filter((item) => item.avisoId && item.employee && item.readAt);
}

async function insertRead(item: AvisoLeitura): Promise<Array<{ id: string }>> {
  const sql = getDatabase();
  return await sql`
    INSERT INTO portal_notice_reads (aviso_id, employee, unit, portal_email, read_at, title)
    VALUES (${item.avisoId}, ${item.employee}, ${item.unit}, ${item.portalEmail}, ${item.readAt}, ${item.title})
    ON CONFLICT (aviso_id, employee, unit) DO NOTHING RETURNING id
  ` as Array<{ id: string }>;
}

async function importFromGoogleIfNeeded(accessToken?: string) {
  if (!accessToken) return;
  const sql = getDatabase();
  const completed = await sql`SELECT key FROM portal_data_migrations WHERE key = ${MIGRATION_KEY} LIMIT 1` as Array<{ key: string }>;
  if (completed.length) return;
  try {
    for (const item of parseLegacyReads(await legacyReadRows(accessToken))) await insertRead(item);
    await sql`INSERT INTO portal_data_migrations (key) VALUES (${MIGRATION_KEY}) ON CONFLICT DO NOTHING`;
  } catch (error) {
    console.warn("[avisos-leituras] importação da planilha aguardando acesso da gestão", error);
  }
}

export async function listFuncionariosAvisos(accessToken: string): Promise<FuncionarioAviso[]> {
  try {
    return (await legacyEmployeeRows(accessToken))
      .filter((row) => row[0] && row[1] && (row[4] || "Sim").toLowerCase() !== "não")
      .map((row) => ({ employee: row[0], unit: row[1], pinConfigured: true }));
  } catch {
    return [];
  }
}

export async function listAvisoLeituras(accessToken = ""): Promise<AvisoLeitura[]> {
  await ensureSchema();
  await importFromGoogleIfNeeded(accessToken);
  const sql = getDatabase();
  const rows = await sql`SELECT aviso_id, employee, unit, portal_email, read_at, title FROM portal_notice_reads ORDER BY read_at DESC, id DESC LIMIT 2000` as LeituraRow[];
  return rows.map((row) => ({ avisoId: row.aviso_id, employee: row.employee, unit: row.unit, portalEmail: row.portal_email, readAt: new Date(row.read_at).toISOString(), title: row.title }));
}

export async function registerAvisoLeitura(
  accessToken: string,
  input: { avisoId: string; employee: string; unit: string; portalEmail: string; title: string },
) {
  await ensureSchema();
  await importFromGoogleIfNeeded(accessToken);
  const inserted = await insertRead({ ...input, readAt: new Date().toISOString() });
  return { alreadyRegistered: inserted.length === 0 };
}

export async function replaceAvisoLeituras(_accessToken: string, reads: AvisoLeitura[]) {
  await ensureSchema();
  const sql = getDatabase();
  await sql`DELETE FROM portal_notice_reads`;
  for (const item of reads) await insertRead(item);
  await sql`INSERT INTO portal_data_migrations (key) VALUES (${MIGRATION_KEY}) ON CONFLICT DO NOTHING`;
}
