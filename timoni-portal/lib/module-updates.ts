import { neon } from "@neondatabase/serverless";

export const UPDATE_MODULES = [
  "avisos",
  "agenda",
  "compras",
  "conferencia",
  "estoque",
  "motorista",
  "reunioes",
  "leads",
  "espaco-equipe",
  "marketing",
  "financeiro",
] as const;

export type UpdateModule = (typeof UPDATE_MODULES)[number];

export type PendingModuleUpdate = {
  module: UpdateModule;
  count: number;
  latestAt: string;
};

const MANAGEMENT_EMAILS = new Set(["mcrodini@gmail.com", "mrodini@gmail.com"]);
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
        CREATE TABLE IF NOT EXISTS portal_module_updates (
          id BIGSERIAL PRIMARY KEY,
          module TEXT NOT NULL,
          actor_email TEXT NOT NULL DEFAULT '',
          summary TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          read_at TIMESTAMPTZ,
          source_key TEXT
        )
      `;
      await sql`ALTER TABLE portal_module_updates ADD COLUMN IF NOT EXISTS source_key TEXT`;
      await sql`
        CREATE INDEX IF NOT EXISTS portal_module_updates_pending_idx
        ON portal_module_updates (module, created_at DESC)
        WHERE read_at IS NULL
      `;
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS portal_module_updates_source_idx
        ON portal_module_updates (source_key)
        WHERE source_key IS NOT NULL
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS portal_module_update_reads (
          viewer_email TEXT NOT NULL,
          module TEXT NOT NULL,
          read_through TIMESTAMPTZ NOT NULL,
          PRIMARY KEY (viewer_email, module)
        )
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export function isUpdateModule(value: unknown): value is UpdateModule {
  return UPDATE_MODULES.includes(value as UpdateModule);
}

export async function recordModuleUpdate(
  module: UpdateModule,
  actorEmail: string | null | undefined,
  summary: string,
  sourceKey?: string,
) {
  const normalizedActor = actorEmail?.trim().toLowerCase() || "colaborador";
  if (MANAGEMENT_EMAILS.has(normalizedActor)) return;

  await ensureSchema();
  const sql = getDatabase();
  await sql`
    INSERT INTO portal_module_updates (module, actor_email, summary, source_key)
    VALUES (${module}, ${normalizedActor}, ${summary.slice(0, 300)}, ${sourceKey || null})
    ON CONFLICT DO NOTHING
  `;
}

export async function recordModuleUpdateSafely(
  module: UpdateModule,
  actorEmail: string | null | undefined,
  summary: string,
  sourceKey?: string,
) {
  try {
    await recordModuleUpdate(module, actorEmail, summary, sourceKey);
  } catch (error) {
    console.error(`[module-updates][${module}]`, error);
  }
}

export async function listPendingModuleUpdates(viewerEmail: string): Promise<PendingModuleUpdate[]> {
  await ensureSchema();
  const sql = getDatabase();
  const rows = await sql`
    SELECT updates.module, COUNT(*)::int AS count, MAX(updates.created_at) AS latest_at
    FROM portal_module_updates updates
    LEFT JOIN portal_module_update_reads reads
      ON reads.module = updates.module
      AND reads.viewer_email = ${viewerEmail.trim().toLowerCase()}
    WHERE updates.read_at IS NULL
      AND updates.created_at > COALESCE(reads.read_through, TIMESTAMPTZ '1970-01-01')
    GROUP BY updates.module
  ` as Array<{ module: string; count: number; latest_at: Date | string }>;

  return rows
    .filter((row) => isUpdateModule(row.module))
    .map((row) => ({
      module: row.module as UpdateModule,
      count: Number(row.count),
      latestAt: new Date(row.latest_at).toISOString(),
    }));
}

export async function markModuleUpdatesRead(module: UpdateModule, through: string, viewerEmail: string) {
  const throughDate = new Date(through);
  if (Number.isNaN(throughDate.getTime())) throw new Error("Data de atualização inválida.");

  await ensureSchema();
  const sql = getDatabase();
  await sql`
    INSERT INTO portal_module_update_reads (viewer_email, module, read_through)
    VALUES (${viewerEmail.trim().toLowerCase()}, ${module}, ${throughDate.toISOString()})
    ON CONFLICT (viewer_email, module)
    DO UPDATE SET read_through = GREATEST(portal_module_update_reads.read_through, EXCLUDED.read_through)
  `;
}
