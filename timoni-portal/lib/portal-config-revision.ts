import { neon } from "@neondatabase/serverless";

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
        CREATE TABLE IF NOT EXISTS portal_configuration_revision (
          singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
          revision BIGINT NOT NULL DEFAULT 1,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        INSERT INTO portal_configuration_revision (singleton)
        VALUES (TRUE)
        ON CONFLICT (singleton) DO NOTHING
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export async function getPortalConfigurationRevision(): Promise<string> {
  await ensureSchema();
  const sql = getDatabase();
  const rows = await sql`
    SELECT revision::TEXT AS revision
    FROM portal_configuration_revision
    WHERE singleton = TRUE
    LIMIT 1
  ` as Array<{ revision: string }>;
  return rows[0]?.revision ?? "1";
}

export async function getPortalConfigurationRevisionSafely(): Promise<string | null> {
  try {
    return await getPortalConfigurationRevision();
  } catch (error) {
    console.error("[portal-config-revision] Falha ao ler a versão.", error);
    return null;
  }
}

export async function bumpPortalConfigurationRevision(): Promise<void> {
  await ensureSchema();
  const sql = getDatabase();
  await sql`
    UPDATE portal_configuration_revision
    SET revision = revision + 1, updated_at = NOW()
    WHERE singleton = TRUE
  `;
}

export async function bumpPortalConfigurationRevisionSafely() {
  try {
    await bumpPortalConfigurationRevision();
  } catch (error) {
    console.error("[portal-config-revision] Não foi possível sinalizar a alteração.", error);
  }
}
