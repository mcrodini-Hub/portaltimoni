import { neon } from "@neondatabase/serverless";

type Need = { id: string; unidade: string; status: string };
export function canReceiveStockNotice(email: string) {
  return ["mcrodini@gmail.com", "estoquetimoni@gmail.com"].includes(email.trim().toLowerCase());
}
let ready: Promise<void> | null = null;
function database() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("Banco não configurado.");
  return neon(url);
}
async function ensureSchema() {
  if (!ready) ready = (async () => {
    const sql = database();
    await sql`CREATE TABLE IF NOT EXISTS portal_stock_notice_reads (
      viewer_email TEXT NOT NULL, need_id TEXT NOT NULL,
      read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (viewer_email, need_id)
    )`;
  })().catch(error => { ready = null; throw error; });
  await ready;
}
export async function unreadStockIds(email: string, needs: Need[]) {
  email = email.trim().toLowerCase();
  if (!canReceiveStockNotice(email)) return [];
  const eligible = needs.filter(n => n.status !== "chegou" && (email === "mcrodini@gmail.com" || n.unidade === "rio_claro"));
  if (!eligible.length) return [];
  await ensureSchema();
  const sql = database();
  const rows = await sql`SELECT need_id FROM portal_stock_notice_reads WHERE viewer_email = ${email} AND need_id = ANY(${eligible.map(n => n.id)})` as {need_id:string}[];
  const read = new Set(rows.map(row => row.need_id));
  return eligible.filter(n => !read.has(n.id)).map(n => n.id);
}
export async function markStockNoticesRead(email: string, ids: string[]) {
  email = email.trim().toLowerCase();
  if (!canReceiveStockNotice(email) || !ids.length) return;
  await ensureSchema();
  const sql = database();
  await sql`INSERT INTO portal_stock_notice_reads (viewer_email, need_id)
    SELECT ${email}, unnest(${ids}::text[]) ON CONFLICT DO NOTHING`;
}
