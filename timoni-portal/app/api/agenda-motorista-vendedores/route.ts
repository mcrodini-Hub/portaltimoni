import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { google } from "googleapis";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SPREADSHEET_ID = "1cESMTRx98e6AbY5vxPCcT7VrqYAbgH0xGUk87ybqHUo";

type Seller = { nome: string; unidade: string };

const fixedSellers: Seller[] = [
  { nome: "Ciça", unidade: "araras" },
  { nome: "Marcelo", unidade: "araras" },
];

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email || !hasModuleAccess(session.user.email, "motorista")) {
      return NextResponse.json({ ok: false, erro: "Acesso não autorizado." }, { status: 403 });
    }
    if (!session.accessToken || session.error === "RefreshAccessTokenError") {
      return NextResponse.json({ ok: false, erro: "Sessão expirada. Saia e entre novamente no Portal." }, { status: 401 });
    }

    const oauth = new google.auth.OAuth2();
    oauth.setCredentials({ access_token: session.accessToken });
    const sheets = google.sheets({ version: "v4", auth: oauth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Vendedores!A:B",
      valueRenderOption: "FORMATTED_VALUE",
    });

    const rows = response.data.values ?? [];
    const vendedores: Seller[] = rows
      .slice(1)
      .map((row) => ({ nome: String(row[0] ?? "").trim(), unidade: String(row[1] ?? "").trim().toLowerCase() }))
      .filter((item) => item.nome);

    const seen = new Set(vendedores.map((item) => `${item.nome.toLowerCase()}-${item.unidade}`));
    for (const seller of fixedSellers) {
      const key = `${seller.nome.toLowerCase()}-${seller.unidade}`;
      if (!seen.has(key)) vendedores.push(seller);
    }

    return NextResponse.json({ ok: true, vendedores }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar vendedores.";
    return NextResponse.json({ ok: false, erro: message }, { status: 400 });
  }
}
