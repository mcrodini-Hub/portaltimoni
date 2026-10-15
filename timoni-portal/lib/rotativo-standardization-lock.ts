import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

// A lease survives function restarts; an uncertain Sheets response keeps it until expiry.
export async function withStandardizationLock<T>(key: string, run: () => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL não configurada no servidor.");
  const sql = neon(url);
  await sql`CREATE TABLE IF NOT EXISTS portal_rotativo_standardization_locks (
    resource TEXT PRIMARY KEY, owner UUID NOT NULL, expires_at TIMESTAMPTZ NOT NULL
  )`;
  const owner = randomUUID();
  const rows = await sql`INSERT INTO portal_rotativo_standardization_locks (resource, owner, expires_at)
    VALUES (${key}, ${owner}::UUID, NOW() + INTERVAL '10 minutes')
    ON CONFLICT (resource) DO UPDATE SET owner = EXCLUDED.owner, expires_at = EXCLUDED.expires_at
    WHERE portal_rotativo_standardization_locks.expires_at < NOW()
    RETURNING resource`;
  if (!rows.length) throw new Error("Esta planilha está sendo padronizada. Aguarde a conclusão antes de tentar novamente.");
  let release = true;
  try {
    return await run();
  } catch (error) {
    release = !(error instanceof Error && error.name === "RotativoUncertainWriteError");
    throw error;
  } finally {
    if (release) await sql`DELETE FROM portal_rotativo_standardization_locks WHERE resource = ${key} AND owner = ${owner}::UUID`;
  }
}
