import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { addLead, addProspect, listLeads, listProspects, updateLeadFollowUp } from "@/lib/leads";

async function authorized() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  return hasModuleAccess(email, "leads");
}

export async function GET() {
  if (!(await authorized())) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  try {
    const [leads, prospects] = await Promise.all([listLeads(), listProspects()]);
    const atrasados = leads.filter((x) => x.status === "atrasado").length;
    const hoje = leads.filter((x) => x.status === "hoje").length;
    const semData = leads.filter((x) => x.status === "sem-data").length;
    return NextResponse.json({ leads, prospects, summary: { atrasados, hoje, semData, pendentes: atrasados + hoje, prospectar: prospects.length } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível carregar os leads." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  try {
    const body = await request.json();
    const destino = String(body?.destino ?? "prospectar");
    const common = {
      cliente: String(body?.cliente ?? "").trim(),
      segmento: String(body?.segmento ?? "").trim(),
      contato: String(body?.contato ?? "").trim(),
      canal: String(body?.canal ?? "").trim(),
      observacoes: String(body?.observacoes ?? "").trim(),
    };
    if (destino === "followup") {
      await addLead({ ...common, proximoContato: String(body?.proximoContato ?? "").trim() });
    } else {
      await addProspect({ ...common, cidade: String(body?.cidade ?? "").trim(), oportunidade: String(body?.oportunidade ?? "").trim() });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível cadastrar." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  try {
    const body = await request.json();
    const row = Number(body?.row);
    const ultimoContato = String(body?.ultimoContato ?? "").trim();
    const proximoContato = String(body?.proximoContato ?? "").trim();
    const observacoes = String(body?.observacoes ?? "").trim();
    if (!proximoContato) return NextResponse.json({ error: "Informe a data do próximo contato." }, { status: 400 });
    await updateLeadFollowUp({ row, ultimoContato, proximoContato, observacoes });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível atualizar o follow-up." }, { status: 500 });
  }
}
