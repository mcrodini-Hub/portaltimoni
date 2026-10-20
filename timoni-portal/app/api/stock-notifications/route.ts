import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { listStockAlerts } from "@/lib/estoque-alerts";
import { canReceiveStockNotice, pendingStockIds } from "@/lib/stock-notice-reads";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() || "";
  const headers = {"Cache-Control":"private, no-store"};
  if (!session || !hasModuleAccess(email, "estoque", session.portalUser) || !canReceiveStockNotice(email)) return NextResponse.json({ok:true, ids:[]}, {headers});
  try {
    const needs = await listStockAlerts(session.accessToken);
    return NextResponse.json({ok:true, ids:pendingStockIds(email, needs)}, {headers});
  } catch {
    return NextResponse.json({ok:false}, {status:503,headers});
  }
}
