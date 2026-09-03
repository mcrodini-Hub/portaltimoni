import { neon } from "@neondatabase/serverless";
import { google } from "googleapis";

export const COMUNICADOS_SPREADSHEET_ID = "1xR4DTaNKad0yfVdnww3KwSAmOcK61ZIbM-v4eX43sjQ";
export const COMUNICADOS_SHEET = "Comunicados";

export type ComunicadoUnidade = "geral" | "araras" | "rio claro";
export type ComunicadoStatus = "ativo" | "arquivado" | "excluido";

export type Comunicado = {
  id: string;
  createdAt: string;
  unit: ComunicadoUnidade;
  title: string;
  message: string;
  status: ComunicadoStatus;
  updatedAt: string;
  startsAt: string;
  expiresAt: string;
};

type ComunicadoRow = {
  id: string;
  created_at: Date | string;
  unit: ComunicadoUnidade;
  title: string;
  message: string;
  status: ComunicadoStatus;
  updated_at: Date | string;
  starts_at: Date | string;
  expires_at: Date | string | null;
};

const MIGRATION_KEY = "comunicados_google_v1";
let database: ReturnType<typeof neon> | null = null;
let schemaReady: Promise<void> | null = null;

const LEGACY_COMUNICADOS: Comunicado[] = [
  {
    id: "legacy-painel-timoni",
    createdAt: "2026-08-17T12:00:00-03:00",
    unit: "geral",
    title: "Nova Ferramenta: Painel Timoni",
    message: "Esta é a nova comunicação interna da Casa Timoni. O Painel Timoni passa a concentrar avisos, comunicados, reuniões, aniversários, férias e informações importantes para a equipe.",
    status: "ativo",
    updatedAt: "2026-08-17T12:00:00-03:00",
    startsAt: "2026-08-17T12:00:00-03:00",
    expiresAt: "",
  },
  {
    id: "legacy-vendas-empresas",
    createdAt: "2026-08-17T12:01:00-03:00",
    unit: "rio claro",
    title: "Vendas Empresas",
    message: "As empresas relacionadas abaixo são atendidas exclusivamente por vendas internas. Todo atendimento, orçamento ou negociação destes clientes deve ser direcionado para Jaqueline.\n\nBrascabos\nCaprem\nCarbifibras\nChemson\nDelta\nEmbramaco\nFastenal\nJaw\nOwens Corning - Brasil GR\nPotencial\nRiclan\nRuy Rocha\nSanta Casa\nScoda\nTigre\nVillagres\nWhirlpool",
    status: "ativo",
    updatedAt: "2026-08-17T12:01:00-03:00",
    startsAt: "2026-08-17T12:01:00-03:00",
    expiresAt: "",
  },
];

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
        CREATE TABLE IF NOT EXISTS portal_notices (
          id TEXT PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL,
          unit TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'ativo',
          updated_at TIMESTAMPTZ NOT NULL,
          starts_at TIMESTAMPTZ NOT NULL,
          expires_at TIMESTAMPTZ
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS portal_notices_created_at_idx ON portal_notices (created_at DESC)`;
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

function parseRows(rows: string[][]): Comunicado[] {
  return rows.map((row) => ({
    id: row[0] ?? "",
    createdAt: row[1] ?? "",
    unit: (row[2] ?? "geral") as ComunicadoUnidade,
    title: row[3] ?? "",
    message: row[4] ?? "",
    status: (row[5] ?? "ativo") as ComunicadoStatus,
    updatedAt: row[6] ?? row[1] ?? "",
    startsAt: row[7] ?? row[1] ?? "",
    expiresAt: row[8] ?? "",
  })).filter((item) => item.id && item.title && item.message);
}

async function fetchLegacyRows(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const response = await google.sheets({ version: "v4", auth }).spreadsheets.values.get({
    spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
    range: `${COMUNICADOS_SHEET}!A2:I500`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (response.data.values ?? []) as string[][];
}

async function upsertComunicado(item: Comunicado) {
  const sql = getDatabase();
  await sql`
    INSERT INTO portal_notices (id, created_at, unit, title, message, status, updated_at, starts_at, expires_at)
    VALUES (
      ${item.id}, ${item.createdAt}, ${item.unit}, ${item.title}, ${item.message}, ${item.status},
      ${item.updatedAt || item.createdAt}, ${item.startsAt || item.createdAt}, ${item.expiresAt || null}
    )
    ON CONFLICT (id) DO UPDATE SET
      created_at = EXCLUDED.created_at, unit = EXCLUDED.unit, title = EXCLUDED.title,
      message = EXCLUDED.message, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at,
      starts_at = EXCLUDED.starts_at, expires_at = EXCLUDED.expires_at
  `;
}

async function importFromGoogleIfNeeded(accessToken?: string) {
  if (!accessToken) return;
  const sql = getDatabase();
  const completed = await sql`SELECT key FROM portal_data_migrations WHERE key = ${MIGRATION_KEY} LIMIT 1` as Array<{ key: string }>;
  if (completed.length) return;
  try {
    const items = parseRows(await fetchLegacyRows(accessToken));
    for (const item of items) await upsertComunicado(item);
    await sql`INSERT INTO portal_data_migrations (key) VALUES (${MIGRATION_KEY}) ON CONFLICT DO NOTHING`;
  } catch (error) {
    console.warn("[comunicados] importação da planilha aguardando acesso da gestão", error);
  }
}

function fromRow(row: ComunicadoRow): Comunicado {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    unit: row.unit,
    title: row.title,
    message: row.message,
    status: row.status,
    updatedAt: new Date(row.updated_at).toISOString(),
    startsAt: new Date(row.starts_at).toISOString(),
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : "",
  };
}

export async function listComunicados(accessToken = "") {
  await ensureSchema();
  await importFromGoogleIfNeeded(accessToken);
  const sql = getDatabase();
  const rows = await sql`
    SELECT id, created_at, unit, title, message, status, updated_at, starts_at, expires_at
    FROM portal_notices ORDER BY created_at DESC
  ` as ComunicadoRow[];
  const stored = rows.map(fromRow);
  const storedIds = new Set(stored.map((item) => item.id));
  return [...stored, ...LEGACY_COMUNICADOS.filter((item) => !storedIds.has(item.id))]
    .filter((item) => item.status !== "excluido")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function createComunicado(
  accessToken: string,
  input: { unit: ComunicadoUnidade; title: string; message: string; startsAt?: string; expiresAt?: string },
) {
  await ensureSchema();
  await importFromGoogleIfNeeded(accessToken);
  const now = new Date().toISOString();
  const id = `com-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await upsertComunicado({ id, createdAt: now, unit: input.unit, title: input.title, message: input.message, status: "ativo", updatedAt: now, startsAt: input.startsAt || now, expiresAt: input.expiresAt || "" });
  return id;
}

export async function updateComunicado(
  accessToken: string,
  id: string,
  input: Partial<Pick<Comunicado, "unit" | "title" | "message" | "status" | "startsAt" | "expiresAt">>,
) {
  const current = (await listComunicados(accessToken)).find((item) => item.id === id);
  if (!current) throw new Error("Comunicado não encontrado.");
  await upsertComunicado({ ...current, ...input, updatedAt: new Date().toISOString() });
}

export async function deleteComunicado(accessToken: string, id: string) {
  await updateComunicado(accessToken, id, { status: "excluido" });
}

export async function replaceComunicados(_accessToken: string, items: Comunicado[]) {
  await ensureSchema();
  const sql = getDatabase();
  await sql`DELETE FROM portal_notices`;
  for (const item of items) await upsertComunicado(item);
  await sql`INSERT INTO portal_data_migrations (key) VALUES (${MIGRATION_KEY}) ON CONFLICT DO NOTHING`;
}
