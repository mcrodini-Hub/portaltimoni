import { neon } from "@neondatabase/serverless";

export type TeamMessage = {
  date: string;
  unit: string;
  employee: string;
  message: string;
  status: string;
  note: string;
};

type TeamMessageRow = {
  created_at: Date | string;
  unit: string;
  employee: string;
  message: string;
  status: string;
  note: string;
};

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
        CREATE TABLE IF NOT EXISTS portal_team_messages (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          unit TEXT NOT NULL,
          employee TEXT NOT NULL,
          message TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Novo',
          note TEXT NOT NULL DEFAULT ''
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS portal_team_messages_created_at_idx
        ON portal_team_messages (created_at DESC)
      `;
      await sql`
        UPDATE portal_team_messages
        SET unit = '', employee = ''
        WHERE unit <> '' OR employee <> ''
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export async function appendTeamMessage(input: {
  message: string;
}, _accessToken?: string) {
  void _accessToken;
  await ensureSchema();
  const sql = getDatabase();
  await sql`
    INSERT INTO portal_team_messages (unit, employee, message)
    VALUES ('', '', ${input.message})
  `;
}

export async function listTeamMessages(_accessToken?: string): Promise<TeamMessage[]> {
  void _accessToken;
  await ensureSchema();
  const sql = getDatabase();
  const rows = await sql`
    SELECT created_at, unit, employee, message, status, note
    FROM portal_team_messages
    ORDER BY created_at DESC, id DESC
    LIMIT 500
  ` as TeamMessageRow[];

  return rows.map((row) => ({
    date: new Date(row.created_at).toISOString(),
    unit: row.unit,
    employee: row.employee,
    message: row.message,
    status: row.status,
    note: row.note,
  }));
}

export async function replaceTeamMessages(_accessToken: string, messages: TeamMessage[]) {
  await ensureSchema();
  const sql = getDatabase();
  await sql`DELETE FROM portal_team_messages`;

  for (const item of messages) {
    await sql`
      INSERT INTO portal_team_messages (created_at, unit, employee, message, status, note)
      VALUES (
        ${item.date || new Date().toISOString()},
        ${""},
        ${""},
        ${item.message},
        ${item.status || "Novo"},
        ${item.note || ""}
      )
    `;
  }
}
