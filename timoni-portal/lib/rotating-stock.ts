import { neon } from "@neondatabase/serverless";

export const ROTATING_STOCK_EMAILS = {
  cica: "mcrodini@gmail.com",
  marcelo: "mrodini@gmail.com",
  lucas: "estoquetimoni@gmail.com",
  carolina: "carolina@casatimoni.com.br",
} as const;

export const ROTATING_STOCK_CENTRAL = {
  spreadsheetId: "1r2BJbEyUN6WL8AnEwRKCgJMaOlBzPTUxQQjXZXfPyj8",
  sheetName: "Produtos",
  range: "B2:D6403",
} as const;

export type RotatingStockStatus = "aguardando_mapeamento" | "aguardando_conferencia" | "em_conferencia" | "atualizado";
export type RotatingStockItemStatus = "encontrado" | "nao_encontrado" | "sem_alteracao";

export type RotatingStockSupplier = {
  id: string;
  name: string;
  spreadsheet_id: string;
  sheet_name: string;
  data_range: string;
  code_column: number;
  description_column: number;
  stock_column: number;
  validated_at: string | null;
  validated_by: string | null;
};

export type RotatingStockUpdate = {
  id: string;
  supplier_id: string | null;
  supplier_name: string;
  spreadsheet_name: string;
  spreadsheet_link: string;
  note: string;
  reported_by: string;
  reported_at: string;
  status: RotatingStockStatus;
  locked_by: string | null;
  locked_at: string | null;
  fingerprint: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  items_read: number;
  found_count: number;
  not_found_count: number;
  unchanged_count: number;
  updated_count: number;
};

export type RotatingStockItem = {
  id: string;
  update_id: string;
  source_row: number;
  target_row: number | null;
  code: string;
  description: string;
  old_stock: number | null;
  new_stock: number;
  situation: RotatingStockItemStatus;
  applied: boolean;
};

let database: ReturnType<typeof neon> | null = null;
let schemaReady: Promise<void> | null = null;

function getDatabase() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL não configurada no servidor.");
  if (!database) database = neon(databaseUrl);
  return database;
}

export async function ensureRotatingStockSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getDatabase();
      await sql`
        CREATE TABLE IF NOT EXISTS portal_rotating_stock_suppliers (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          spreadsheet_id TEXT NOT NULL,
          sheet_name TEXT NOT NULL,
          data_range TEXT NOT NULL,
          code_column INTEGER NOT NULL DEFAULT 0,
          description_column INTEGER NOT NULL DEFAULT 1,
          stock_column INTEGER NOT NULL DEFAULT 2,
          validated_at TIMESTAMPTZ,
          validated_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (spreadsheet_id, sheet_name)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS portal_rotating_stock_updates (
          id UUID PRIMARY KEY,
          supplier_id BIGINT REFERENCES portal_rotating_stock_suppliers(id),
          supplier_name TEXT NOT NULL,
          spreadsheet_name TEXT NOT NULL DEFAULT '',
          spreadsheet_link TEXT NOT NULL DEFAULT '',
          note TEXT NOT NULL DEFAULT '',
          reported_by TEXT NOT NULL,
          reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          status TEXT NOT NULL,
          locked_by TEXT,
          locked_at TIMESTAMPTZ,
          fingerprint TEXT,
          reviewed_by TEXT,
          reviewed_at TIMESTAMPTZ,
          items_read INTEGER NOT NULL DEFAULT 0,
          found_count INTEGER NOT NULL DEFAULT 0,
          not_found_count INTEGER NOT NULL DEFAULT 0,
          unchanged_count INTEGER NOT NULL DEFAULT 0,
          updated_count INTEGER NOT NULL DEFAULT 0
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS portal_rotating_stock_items (
          id BIGSERIAL PRIMARY KEY,
          update_id UUID NOT NULL REFERENCES portal_rotating_stock_updates(id) ON DELETE CASCADE,
          source_row INTEGER NOT NULL,
          target_row INTEGER,
          code TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          old_stock INTEGER,
          new_stock INTEGER NOT NULL,
          situation TEXT NOT NULL,
          applied BOOLEAN NOT NULL DEFAULT FALSE,
          resolved_at TIMESTAMPTZ,
          resolved_by TEXT,
          UNIQUE (update_id, source_row)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS portal_rotating_stock_updates_status_idx
        ON portal_rotating_stock_updates (status, reported_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS portal_rotating_stock_items_pending_idx
        ON portal_rotating_stock_items (situation, resolved_at)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS portal_rotating_stock_highlights (
          id BIGSERIAL PRIMARY KEY,
          target_row INTEGER NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          cleared_at TIMESTAMPTZ,
          update_id UUID NOT NULL REFERENCES portal_rotating_stock_updates(id) ON DELETE CASCADE
        )
      `;
      await sql`
        INSERT INTO portal_rotating_stock_suppliers
          (name, spreadsheet_id, sheet_name, data_range, code_column, description_column, stock_column, validated_at, validated_by)
        VALUES
          ('KTELI', '1WhU4TlFxnK4UhjUOIwGCcVC5NvDZlqN6lXhAiIj1i20', 'kteli', 'B6:D31', 0, 1, 2, NOW(), 'regra-inicial')
        ON CONFLICT (spreadsheet_id, sheet_name) DO NOTHING
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

function normalizeDate<T>(row: T): T {
  const result = { ...(row as Record<string, unknown>) };
  for (const key of ["reported_at", "locked_at", "reviewed_at", "validated_at", "expires_at"] as const) {
    if (result[key]) result[key] = new Date(result[key] as string | Date).toISOString();
  }
  return result as T;
}

export async function listRotatingStockData() {
  await ensureRotatingStockSchema();
  const sql = getDatabase();
  const [updates, suppliers, pendingRows, notFoundItems] = await Promise.all([
    sql`SELECT *, id::TEXT, supplier_id::TEXT FROM portal_rotating_stock_updates ORDER BY reported_at DESC LIMIT 100`,
    sql`SELECT *, id::TEXT FROM portal_rotating_stock_suppliers ORDER BY name`,
    sql`SELECT COUNT(*)::INTEGER AS count FROM portal_rotating_stock_items WHERE situation = 'nao_encontrado' AND resolved_at IS NULL`,
    sql`
      SELECT items.id::TEXT, items.update_id::TEXT, items.code, items.description, items.new_stock,
        updates.supplier_name, updates.reported_at
      FROM portal_rotating_stock_items items
      INNER JOIN portal_rotating_stock_updates updates ON updates.id = items.update_id
      WHERE items.situation = 'nao_encontrado' AND items.resolved_at IS NULL
      ORDER BY updates.reported_at DESC, items.source_row
      LIMIT 300
    `,
  ]);
  return {
    updates: (updates as unknown as RotatingStockUpdate[]).map(normalizeDate),
    suppliers: (suppliers as unknown as RotatingStockSupplier[]).map(normalizeDate),
    notFoundPending: Number(((pendingRows as unknown as Array<{ count?: number }>)[0])?.count || 0),
    notFoundItems: (notFoundItems as unknown as Array<Record<string, unknown>>).map(normalizeDate),
  };
}

export async function getRotatingStockUpdate(id: string) {
  await ensureRotatingStockSchema();
  const sql = getDatabase();
  const rows = await sql`SELECT *, id::TEXT, supplier_id::TEXT FROM portal_rotating_stock_updates WHERE id = ${id}::UUID LIMIT 1` as unknown as RotatingStockUpdate[];
  return rows[0] ? normalizeDate(rows[0] as unknown as RotatingStockUpdate) : null;
}

export async function getRotatingStockSupplier(id: string) {
  await ensureRotatingStockSchema();
  const sql = getDatabase();
  const rows = await sql`SELECT *, id::TEXT FROM portal_rotating_stock_suppliers WHERE id = ${id}::BIGINT LIMIT 1` as unknown as RotatingStockSupplier[];
  return rows[0] ? normalizeDate(rows[0] as unknown as RotatingStockSupplier) : null;
}

export async function findSupplier(spreadsheetId: string, name: string) {
  await ensureRotatingStockSchema();
  const sql = getDatabase();
  const rows = await sql`
    SELECT *, id::TEXT FROM portal_rotating_stock_suppliers
    WHERE spreadsheet_id = ${spreadsheetId} OR LOWER(name) = LOWER(${name})
    ORDER BY validated_at DESC NULLS LAST LIMIT 1
  ` as unknown as RotatingStockSupplier[];
  return rows[0] ? normalizeDate(rows[0] as unknown as RotatingStockSupplier) : null;
}

export async function createRotatingStockUpdate(input: {
  id: string; supplierId: string | null; supplierName: string; spreadsheetName: string;
  spreadsheetLink: string; note: string; reportedBy: string; status: RotatingStockStatus;
}) {
  await ensureRotatingStockSchema();
  const sql = getDatabase();
  await sql`
    INSERT INTO portal_rotating_stock_updates
      (id, supplier_id, supplier_name, spreadsheet_name, spreadsheet_link, note, reported_by, status)
    VALUES
      (${input.id}::UUID, ${input.supplierId}::BIGINT, ${input.supplierName}, ${input.spreadsheetName},
       ${input.spreadsheetLink}, ${input.note}, ${input.reportedBy}, ${input.status})
  `;
}

export async function saveSupplierMapping(input: {
  id?: string; name: string; spreadsheetId: string; sheetName: string; dataRange: string;
  codeColumn: number; descriptionColumn: number; stockColumn: number; actor: string;
}) {
  await ensureRotatingStockSchema();
  const sql = getDatabase();
  const rows = (input.id
    ? await sql`
        UPDATE portal_rotating_stock_suppliers SET name = ${input.name}, spreadsheet_id = ${input.spreadsheetId},
          sheet_name = ${input.sheetName}, data_range = ${input.dataRange}, code_column = ${input.codeColumn},
          description_column = ${input.descriptionColumn}, stock_column = ${input.stockColumn},
          validated_at = NOW(), validated_by = ${input.actor}
        WHERE id = ${input.id}::BIGINT RETURNING id::TEXT
      `
    : await sql`
        INSERT INTO portal_rotating_stock_suppliers
          (name, spreadsheet_id, sheet_name, data_range, code_column, description_column, stock_column, validated_at, validated_by)
        VALUES (${input.name}, ${input.spreadsheetId}, ${input.sheetName}, ${input.dataRange}, ${input.codeColumn},
          ${input.descriptionColumn}, ${input.stockColumn}, NOW(), ${input.actor})
        ON CONFLICT (spreadsheet_id, sheet_name) DO UPDATE SET name = EXCLUDED.name, data_range = EXCLUDED.data_range,
          code_column = EXCLUDED.code_column, description_column = EXCLUDED.description_column,
          stock_column = EXCLUDED.stock_column, validated_at = NOW(), validated_by = EXCLUDED.validated_by
        RETURNING id::TEXT
      `) as unknown as Array<{ id: string }>;
  return String((rows[0] as { id: string }).id);
}

export async function attachSupplierToWaitingUpdates(supplierId: string, spreadsheetId: string, supplierName: string) {
  const sql = getDatabase();
  await sql`
    UPDATE portal_rotating_stock_updates
    SET supplier_id = ${supplierId}::BIGINT, status = 'aguardando_conferencia'
    WHERE status = 'aguardando_mapeamento'
      AND (LOWER(supplier_name) = LOWER(${supplierName}) OR spreadsheet_link LIKE ${`%${spreadsheetId}%`})
  `;
}

export async function acquireRotatingStockLock(id: string, actor: string) {
  await ensureRotatingStockSchema();
  const sql = getDatabase();
  const rows = await sql`
    UPDATE portal_rotating_stock_updates
    SET status = 'em_conferencia', locked_by = ${actor}, locked_at = NOW()
    WHERE id = ${id}::UUID
      AND status IN ('aguardando_conferencia', 'em_conferencia')
      AND (locked_by IS NULL OR locked_by = ${actor} OR locked_at < NOW() - INTERVAL '30 minutes')
    RETURNING id::TEXT
  ` as unknown as Array<{ id: string }>;
  return Boolean(rows[0]);
}

export async function saveConference(id: string, actor: string, fingerprint: string, items: Omit<RotatingStockItem, "id" | "update_id" | "applied">[]) {
  const sql = getDatabase();
  await sql`DELETE FROM portal_rotating_stock_items WHERE update_id = ${id}::UUID`;
  for (const item of items) {
    await sql`
      INSERT INTO portal_rotating_stock_items
        (update_id, source_row, target_row, code, description, old_stock, new_stock, situation)
      VALUES (${id}::UUID, ${item.source_row}, ${item.target_row}, ${item.code}, ${item.description},
        ${item.old_stock}, ${item.new_stock}, ${item.situation})
    `;
  }
  const found = items.filter((item) => item.situation === "encontrado").length;
  const notFound = items.filter((item) => item.situation === "nao_encontrado").length;
  const unchanged = items.filter((item) => item.situation === "sem_alteracao").length;
  await sql`
    UPDATE portal_rotating_stock_updates SET fingerprint = ${fingerprint}, locked_by = ${actor}, locked_at = NOW(),
      items_read = ${items.length}, found_count = ${found}, not_found_count = ${notFound}, unchanged_count = ${unchanged}
    WHERE id = ${id}::UUID
  `;
}

export async function listConferenceItems(id: string) {
  await ensureRotatingStockSchema();
  const sql = getDatabase();
  return await sql`
    SELECT *, id::TEXT, update_id::TEXT FROM portal_rotating_stock_items
    WHERE update_id = ${id}::UUID ORDER BY source_row
  ` as unknown as RotatingStockItem[];
}

export async function finishConference(id: string, actor: string, selectedIds: string[], targetRows: number[]) {
  const sql = getDatabase();
  await sql`
    UPDATE portal_rotating_stock_items SET applied = TRUE
    WHERE update_id = ${id}::UUID AND id = ANY(${selectedIds}::BIGINT[])
  `;
  await sql`
    UPDATE portal_rotating_stock_updates SET status = 'atualizado', reviewed_by = ${actor}, reviewed_at = NOW(),
      updated_count = ${selectedIds.length}, locked_by = NULL, locked_at = NULL
    WHERE id = ${id}::UUID
  `;
  for (const targetRow of targetRows) {
    await sql`
      INSERT INTO portal_rotating_stock_highlights (target_row, expires_at, update_id)
      VALUES (${targetRow}, NOW() + INTERVAL '3 days', ${id}::UUID)
    `;
  }
}

export async function listExpiredHighlights() {
  await ensureRotatingStockSchema();
  const sql = getDatabase();
  return await sql`
    SELECT id::TEXT, target_row FROM portal_rotating_stock_highlights
    WHERE cleared_at IS NULL AND expires_at <= NOW() ORDER BY target_row
  ` as unknown as Array<{ id: string; target_row: number }>;
}

export async function markHighlightsCleared(ids: string[]) {
  if (!ids.length) return;
  const sql = getDatabase();
  await sql`UPDATE portal_rotating_stock_highlights SET cleared_at = NOW() WHERE id = ANY(${ids}::BIGINT[])`;
}

export async function resolveNotFoundItem(id: string, actor: string) {
  await ensureRotatingStockSchema();
  const sql = getDatabase();
  const rows = await sql`
    UPDATE portal_rotating_stock_items SET resolved_at = NOW(), resolved_by = ${actor}
    WHERE id = ${id}::BIGINT AND situation = 'nao_encontrado' AND resolved_at IS NULL
    RETURNING id::TEXT
  ` as unknown as Array<{ id: string }>;
  return Boolean(rows[0]);
}
