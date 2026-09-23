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
  source_sheet_name: string;
  source_code_column: string;
  source_description_column: string;
  source_stock_column: string;
  source_start_row: number;
  trello_card_id: string;
  updated_rows?: number[];
  conference_rows?: number[];
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

export type RotatingStockHistory = {
  id: string;
  update_id: string;
  recorded_at: string;
  code: string;
  old_stock: number | null;
  current_stock: number;
  difference: number | null;
};

export type RotatingStockSupplierStandardization = {
  spreadsheet_id: string;
  supplier_name: string;
  spreadsheet_url: string;
  sheet_name: string;
  status: "preparada" | "atualizada";
  prepared_at: string;
  prepared_by: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
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
        ALTER TABLE portal_rotating_stock_updates
          ADD COLUMN IF NOT EXISTS source_sheet_name TEXT NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS source_code_column TEXT NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS source_description_column TEXT NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS source_stock_column TEXT NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS source_start_row INTEGER NOT NULL DEFAULT 1,
          ADD COLUMN IF NOT EXISTS trello_card_id TEXT NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
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
        CREATE TABLE IF NOT EXISTS portal_rotating_stock_history (
          id BIGSERIAL PRIMARY KEY,
          update_id UUID NOT NULL REFERENCES portal_rotating_stock_updates(id) ON DELETE CASCADE,
          source_row INTEGER NOT NULL,
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          code TEXT NOT NULL,
          old_stock INTEGER,
          current_stock INTEGER NOT NULL,
          difference INTEGER,
          UNIQUE (update_id, source_row)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS portal_rotating_stock_supplier_standardizations (
          spreadsheet_id TEXT PRIMARY KEY,
          supplier_name TEXT NOT NULL,
          spreadsheet_url TEXT NOT NULL,
          sheet_name TEXT NOT NULL,
          status TEXT NOT NULL,
          prepared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          prepared_by TEXT NOT NULL,
          confirmed_at TIMESTAMPTZ,
          confirmed_by TEXT
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS portal_rotating_stock_migrations (
          key TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      const cleanup = (await sql`
        INSERT INTO portal_rotating_stock_migrations (key)
        VALUES ('2026-09-22-limpa-testes-iniciais')
        ON CONFLICT (key) DO NOTHING
        RETURNING key
      `) as unknown as Array<{ key: string }>;
      if (cleanup.length) {
        await sql`DELETE FROM portal_rotating_stock_highlights`;
        await sql`DELETE FROM portal_rotating_stock_items`;
        await sql`DELETE FROM portal_rotating_stock_updates`;
        await sql`DELETE FROM portal_rotating_stock_suppliers`;
      }
      const highlightBackfill = (await sql`
        INSERT INTO portal_rotating_stock_migrations (key)
        VALUES ('2026-09-22-destaques-conferidos')
        ON CONFLICT (key) DO NOTHING
        RETURNING key
      `) as unknown as Array<{ key: string }>;
      if (highlightBackfill.length) {
        await sql`
          INSERT INTO portal_rotating_stock_highlights (target_row, expires_at, update_id)
          SELECT DISTINCT items.target_row, updates.reviewed_at + INTERVAL '3 days', updates.id
          FROM portal_rotating_stock_items items
          INNER JOIN portal_rotating_stock_updates updates ON updates.id = items.update_id
          WHERE updates.status = 'atualizado'
            AND updates.reviewed_at IS NOT NULL
            AND updates.reviewed_at + INTERVAL '3 days' > NOW()
            AND items.target_row IS NOT NULL
            AND items.situation <> 'nao_encontrado'
            AND NOT EXISTS (
              SELECT 1
              FROM portal_rotating_stock_highlights existing
              WHERE existing.update_id = updates.id
                AND existing.target_row = items.target_row
            )
        `;
      }
      await sql`
        CREATE INDEX IF NOT EXISTS portal_rotating_stock_updates_status_idx
        ON portal_rotating_stock_updates (status, reported_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS portal_rotating_stock_items_pending_idx
        ON portal_rotating_stock_items (situation, resolved_at)
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
  const [updates, suppliers, pendingRows, notFoundItems, history, supplierStandardizations] = await Promise.all([
    sql`SELECT updates.*, updates.id::TEXT, updates.supplier_id::TEXT,
      COALESCE((SELECT ARRAY_AGG(items.target_row ORDER BY items.target_row) FILTER (WHERE items.target_row IS NOT NULL)
        FROM portal_rotating_stock_items items
        WHERE items.update_id = updates.id AND items.applied = TRUE), ARRAY[]::INTEGER[]) AS updated_rows,
      COALESCE((SELECT ARRAY_AGG(items.target_row ORDER BY items.target_row) FILTER (WHERE items.target_row IS NOT NULL)
        FROM portal_rotating_stock_items items
        WHERE items.update_id = updates.id AND items.situation <> 'nao_encontrado'), ARRAY[]::INTEGER[]) AS conference_rows
      FROM portal_rotating_stock_updates updates
      WHERE updates.deleted_at IS NULL
      ORDER BY updates.reported_at DESC LIMIT 100`,
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
    sql`
      SELECT history.id::TEXT, history.update_id::TEXT, history.recorded_at, history.code,
        history.old_stock, history.current_stock, history.difference
      FROM portal_rotating_stock_history history
      INNER JOIN portal_rotating_stock_updates updates ON updates.id = history.update_id
      WHERE updates.deleted_at IS NULL
      ORDER BY history.recorded_at DESC, history.id DESC
      LIMIT 200
    `,
    sql`
      SELECT spreadsheet_id, supplier_name, spreadsheet_url, sheet_name, status,
        prepared_at, prepared_by, confirmed_at, confirmed_by
      FROM portal_rotating_stock_supplier_standardizations
      ORDER BY LOWER(supplier_name), supplier_name
    `,
  ]);
  return {
    updates: (updates as unknown as RotatingStockUpdate[]).map(normalizeDate),
    suppliers: (suppliers as unknown as RotatingStockSupplier[]).map(normalizeDate),
    notFoundPending: Number(((pendingRows as unknown as Array<{ count?: number }>)[0])?.count || 0),
    notFoundItems: (notFoundItems as unknown as Array<Record<string, unknown>>).map(normalizeDate),
    history: (history as unknown as RotatingStockHistory[]).map(normalizeDate),
    supplierStandardizations: (supplierStandardizations as unknown as RotatingStockSupplierStandardization[]).map(normalizeDate),
  };
}

export async function getRotatingStockUpdate(id: string) {
  await ensureRotatingStockSchema();
  const sql = getDatabase();
  const rows = await sql`SELECT *, id::TEXT, supplier_id::TEXT FROM portal_rotating_stock_updates WHERE id = ${id}::UUID AND deleted_at IS NULL LIMIT 1` as unknown as RotatingStockUpdate[];
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
  sourceSheetName: string; sourceCodeColumn: string; sourceDescriptionColumn: string;
  sourceStockColumn: string; sourceStartRow: number; trelloCardId?: string;
}) {
  await ensureRotatingStockSchema();
  const sql = getDatabase();
  await sql`
    INSERT INTO portal_rotating_stock_updates
      (id, supplier_id, supplier_name, spreadsheet_name, spreadsheet_link, note, reported_by, status,
       source_sheet_name, source_code_column, source_description_column, source_stock_column, source_start_row, trello_card_id)
    VALUES
      (${input.id}::UUID, ${input.supplierId}::BIGINT, ${input.supplierName}, ${input.spreadsheetName},
       ${input.spreadsheetLink}, ${input.note}, ${input.reportedBy}, ${input.status},
       ${input.sourceSheetName}, ${input.sourceCodeColumn}, ${input.sourceDescriptionColumn},
       ${input.sourceStockColumn}, ${input.sourceStartRow}, ${input.trelloCardId || ""})
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
  if (selectedIds.length) {
    await sql`
      UPDATE portal_rotating_stock_items SET applied = TRUE
      WHERE update_id = ${id}::UUID AND id = ANY(${selectedIds}::BIGINT[])
    `;
  }
  await sql`
    INSERT INTO portal_rotating_stock_history
      (update_id, source_row, recorded_at, code, old_stock, current_stock, difference)
    SELECT items.update_id, items.source_row, NOW(), items.code, items.old_stock, items.new_stock,
      CASE WHEN items.old_stock IS NULL THEN NULL ELSE items.new_stock - items.old_stock END
    FROM portal_rotating_stock_items items
    WHERE items.update_id = ${id}::UUID
      AND items.situation <> 'nao_encontrado'
    ON CONFLICT (update_id, source_row) DO UPDATE SET
      recorded_at = EXCLUDED.recorded_at,
      code = EXCLUDED.code,
      old_stock = EXCLUDED.old_stock,
      current_stock = EXCLUDED.current_stock,
      difference = EXCLUDED.difference
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
    SELECT highlights.id::TEXT, highlights.target_row
    FROM portal_rotating_stock_highlights highlights
    WHERE highlights.cleared_at IS NULL
      AND highlights.expires_at <= NOW()
      AND NOT EXISTS (
        SELECT 1
        FROM portal_rotating_stock_highlights active
        WHERE active.target_row = highlights.target_row
          AND active.cleared_at IS NULL
          AND active.expires_at > NOW()
      )
    ORDER BY highlights.target_row
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


export async function reopenRotatingStockUpdate(input: {
  id: string;
  supplierName: string;
  spreadsheetName: string;
  spreadsheetLink: string;
  note: string;
  sourceSheetName: string;
  sourceCodeColumn: string;
  sourceDescriptionColumn: string;
  sourceStockColumn: string;
  sourceStartRow: number;
  trelloCardId?: string;
}) {
  await ensureRotatingStockSchema();
  const sql = getDatabase();
  await sql`
    UPDATE portal_rotating_stock_updates
    SET supplier_name = ${input.supplierName},
        spreadsheet_name = ${input.spreadsheetName},
        spreadsheet_link = ${input.spreadsheetLink},
        note = ${input.note},
        source_sheet_name = ${input.sourceSheetName},
        source_code_column = ${input.sourceCodeColumn},
        source_description_column = ${input.sourceDescriptionColumn},
        source_stock_column = ${input.sourceStockColumn},
        source_start_row = ${input.sourceStartRow},
        trello_card_id = CASE WHEN ${input.trelloCardId || ""} <> '' THEN ${input.trelloCardId || ""} ELSE trello_card_id END,
        status = 'aguardando_conferencia',
        locked_by = NULL,
        locked_at = NULL,
        fingerprint = NULL
    WHERE id = ${input.id}::UUID
  `;
  await sql`DELETE FROM portal_rotating_stock_items WHERE update_id = ${input.id}::UUID`;
}


export async function prepareSupplierStandardization(input: {
  spreadsheetId: string;
  supplierName: string;
  spreadsheetUrl: string;
  sheetName: string;
  actor: string;
}) {
  await ensureRotatingStockSchema();
  const sql = getDatabase();
  await sql`
    INSERT INTO portal_rotating_stock_supplier_standardizations
      (spreadsheet_id, supplier_name, spreadsheet_url, sheet_name, status, prepared_at, prepared_by, confirmed_at, confirmed_by)
    VALUES
      (${input.spreadsheetId}, ${input.supplierName}, ${input.spreadsheetUrl}, ${input.sheetName},
       'preparada', NOW(), ${input.actor}, NULL, NULL)
    ON CONFLICT (spreadsheet_id) DO UPDATE SET
      supplier_name = EXCLUDED.supplier_name,
      spreadsheet_url = EXCLUDED.spreadsheet_url,
      sheet_name = EXCLUDED.sheet_name,
      status = 'preparada',
      prepared_at = NOW(),
      prepared_by = EXCLUDED.prepared_by,
      confirmed_at = NULL,
      confirmed_by = NULL
  `;
}

export async function confirmSupplierStandardization(spreadsheetId: string, actor: string) {
  await ensureRotatingStockSchema();
  const sql = getDatabase();
  const rows = await sql`
    UPDATE portal_rotating_stock_supplier_standardizations
    SET status = 'atualizada', confirmed_at = NOW(), confirmed_by = ${actor}
    WHERE spreadsheet_id = ${spreadsheetId}
      AND status = 'preparada'
    RETURNING spreadsheet_id
  ` as unknown as Array<{ spreadsheet_id: string }>;
  return Boolean(rows[0]);
}

export async function deleteCompletedRotatingStockUpdate(id: string) {
  await ensureRotatingStockSchema();
  const sql = getDatabase();
  const rows = await sql`
    UPDATE portal_rotating_stock_updates
    SET deleted_at = NOW()
    WHERE id = ${id}::UUID
      AND status = 'atualizado'
      AND deleted_at IS NULL
    RETURNING id::TEXT
  ` as unknown as Array<{ id: string }>;
  return Boolean(rows[0]);
}
