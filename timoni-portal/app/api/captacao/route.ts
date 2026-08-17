import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPortalUser, hasModuleAccess } from "@/lib/access-control";
import { createLead, listLeads, listLogs, registerAction, type LeadStatus } from "@/lib/captacao";

function actor(email: string) {
  const user = getPortalUser(email);
  return user ? `${user.name} <${user.email}>` : email;
}

async function guard() {
  const session = await auth();
  const email = session?.user?.email || "";
  if (!email || !hasModuleAccess(email, "captacao")) return { error: NextResponse.json({ error: "Acesso negado." }, { status: 403 }) };
  return { email };
}

export async function GET() {
  const access = await guard();
  if ("error" in access) return access.error;
  try {
    const [leads, logs] = await Promise.all([listLeads(), listLogs()]);
    return NextResponse.json({ leads, logs });
  } catch (error) {
    console.error("[captacao][GET]", error);
    return NextResponse.json({ error: "Não foi possível carregar a captação." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const access = await guard();
  if ("error" in access) return access.error;
  try {
    const body = await request.json();
    if (!body.nome?.trim() || !body.telefone?.trim() || !body.loja || !body.origem || !body.responsavel) {
      return NextResponse.json({ error: "Preencha cliente, telefone/WhatsApp, loja, origem e responsável." }, { status: 400 });
    }
    const lead = await createLead({
      nome: body.nome,
      telefone: body.telefone,
      loja: body.loja,
      origem: body.origem,
      responsavel: body.responsavel,
      proximoFollowUp: body.proximoFollowUp || "",
      observacao: body.observacao || "",
    }, actor(access.email));
    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    console.error("[captacao][POST]", error);
    return NextResponse.json({ error: "Não foi possível cadastrar o lead." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const access = await guard();
  if ("error" in access) return access.error;
  try {
    const body = await request.json();
    if (!body.leadId || !body.acao) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    const lead = await registerAction(body.leadId, actor(access.email), {
      acao: body.acao,
      detalhe: body.detalhe,
      status: body.status as LeadStatus | undefined,
      proximoFollowUp: body.proximoFollowUp,
      observacao: body.observacao,
    });
    return NextResponse.json({ lead });
  } catch (error) {
    console.error("[captacao][PATCH]", error);
    return NextResponse.json({ error: "Não foi possível registrar a ação." }, { status: 500 });
  }
}
