import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { listLeads, updateLeadFollowUp } from "@/lib/leads";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!hasModuleAccess(email, "leads")) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  try {
    const leads = await listLeads();
    const atrasados = leads.filter((x) => x.status === "atrasado").length;
    const hoje = leads.filter((x) => x.status === "hoje").length;
    const semData = leads.filter((x) => x.status === "sem-data").length;
    return NextResponse.json({ leads, summary: { atrasados, hoje, semData, pendentes: atrasados + hoje } });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar os leads." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!hasModuleAccess(email, "leads")) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  try {
    const body = await request.json();
    const row = Number(body?.row);
    const ultimoContato = String(body?.ultimoContato ?? "").trim();
    const proximoContato = String(body?.proximoContato ?? "").trim();
    const observacoes = String(body?.observacoes ?? "").trim();
    if (!proximoContato) return NextResponse.json({ error: "Informe a data do próximo contato." }, { status: 400 });
    await updateLeadFollowUp({ row, ultimoContato, proximoContato, observacoes });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar o follow-up." }, { status: 500 });
  }
}
