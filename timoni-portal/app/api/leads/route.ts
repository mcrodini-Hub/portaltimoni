import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { addLead, addProspect, createLeadsReport, importLeads, listLeadActivities, listLeads, listProspects, moveLeadToProspects, reactivateProspect, updateLeadFollowUp } from "@/lib/leads";

async function authorizedAccessToken() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!hasModuleAccess(email, "leads")) return null;
  return session?.accessToken ?? null;
}

export async function GET() {
  const accessToken = await authorizedAccessToken();
  if (!accessToken) return NextResponse.json({ error: "Sessão Google sem acesso à planilha. Entre novamente no Portal." }, { status: 401 });
  try {
    const [leads, prospects, activities] = await Promise.all([listLeads(accessToken), listProspects(accessToken), listLeadActivities(accessToken)]);
    const atrasados = leads.filter((x) => x.status === "atrasado").length;
    const hoje = leads.filter((x) => x.status === "hoje").length;
    const semData = leads.filter((x) => x.status === "sem-data").length;
    return NextResponse.json({ leads, prospects, activities, summary: { atrasados, hoje, semData, pendentes: atrasados + hoje, prospectar: prospects.length } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível carregar os leads." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const accessToken = await authorizedAccessToken();
  if (!accessToken) return NextResponse.json({ error: "Sessão Google sem acesso à planilha. Entre novamente no Portal." }, { status: 401 });
  try {
    const body = await request.json();
    if (body?.action === "gerar_relatorio") {
      const result = await createLeadsReport({
        startDate: String(body?.startDate ?? "").trim(),
        endDate: String(body?.endDate ?? "").trim(),
      }, accessToken);
      return NextResponse.json({ ok: true, ...result });
    }
    if (body?.action === "reativar") {
      await reactivateProspect({
        id: String(body?.id ?? ""),
        cliente: String(body?.cliente ?? "").trim(),
        segmento: String(body?.segmento ?? "").trim(),
        contato: String(body?.contato ?? "").trim(),
        canal: String(body?.canal ?? "").trim(),
        proximoContato: String(body?.proximoContato ?? "").trim(),
        observacoes: String(body?.observacoes ?? "").trim(),
      }, accessToken);
      return NextResponse.json({ ok: true });
    }
    if (body?.action === "mover_para_prospectar") {
      await moveLeadToProspects({ row: Number(body?.row) }, accessToken);
      return NextResponse.json({ ok: true });
    }
    const destino = String(body?.destino ?? "prospectar");
    const common = {
      cliente: String(body?.cliente ?? "").trim(),
      segmento: String(body?.segmento ?? "").trim(),
      contato: String(body?.contato ?? "").trim(),
      canal: String(body?.canal ?? "").trim(),
      observacoes: String(body?.observacoes ?? "").trim(),
    };
    if (destino === "followup") {
      await addLead({ ...common, proximoContato: String(body?.proximoContato ?? "").trim() }, accessToken);
    } else {
      await addProspect({ ...common, cidade: String(body?.cidade ?? "").trim(), oportunidade: String(body?.oportunidade ?? "").trim() }, accessToken);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível cadastrar." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const accessToken = await authorizedAccessToken();
  if (!accessToken) return NextResponse.json({ error: "Sessão Google sem acesso à planilha. Entre novamente no Portal." }, { status: 401 });
  try {
    const body = await request.json();
    const row = Number(body?.row);
    const cliente = String(body?.cliente ?? "").trim();
    const segmento = String(body?.segmento ?? "").trim();
    const contato = String(body?.contato ?? "").trim();
    const canal = String(body?.canal ?? "").trim();
    const ultimoContato = String(body?.ultimoContato ?? "").trim();
    const proximoContato = String(body?.proximoContato ?? "").trim();
    const observacoes = String(body?.observacoes ?? "").trim();
    if (!proximoContato) return NextResponse.json({ error: "Informe a data do próximo contato." }, { status: 400 });
    await updateLeadFollowUp({ row, cliente, segmento, contato, canal, ultimoContato, proximoContato, observacoes }, accessToken);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível atualizar o follow-up." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const accessToken = await authorizedAccessToken();
  if (!accessToken) return NextResponse.json({ error: "Sessão Google sem acesso à planilha. Entre novamente no Portal." }, { status: 401 });
  try {
    const body = await request.json();
    const result = await importLeads(body?.rows, accessToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível importar o arquivo." }, { status: 400 });
  }
}
