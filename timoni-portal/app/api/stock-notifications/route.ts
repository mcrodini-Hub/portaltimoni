import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { listStockAlerts } from "@/lib/estoque-alerts";
import { canReceiveStockNotice, unreadStockIds, markStockNoticesRead } from "@/lib/stock-notice-reads";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function viewer() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() || "";
  return session && hasModuleAccess(email, "estoque", session.portalUser) && canReceiveStockNotice(email) ? {email, session} : null;
}
export async function GET() {
  const current = await viewer();
  if (!current) return NextResponse.json({ok:true, ids:[]}, {headers:{"Cache-Control":"private, no-store"}});
  try {
    const needs = await listStockAlerts(current.session.accessToken);
    return NextResponse.json({ok:true, ids:await unreadStockIds(current.email, needs)}, {headers:{"Cache-Control":"private, no-store"}});
  } catch {
    return NextResponse.json({ok:false}, {status:503});
  }
}
export async function POST(request: Request) {
  const current = await viewer();
  if (!current) return NextResponse.json({ok:false}, {status:403});
  try {
    const body = await request.json();
    if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 500 || body.ids.some((id:unknown) => typeof id !== "string" || !id || id.length > 200)) return NextResponse.json({ok:false}, {status:400});
    await markStockNoticesRead(current.email, [...new Set<string>(body.ids)]);
    return NextResponse.json({ok:true});
  } catch {
    return NextResponse.json({ok:false}, {status:503});
  }
}
