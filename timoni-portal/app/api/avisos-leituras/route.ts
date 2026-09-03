import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPortalUser, type PortalUser } from "@/lib/access-control";
import { listComunicados } from "@/lib/comunicados";
import { getEffectiveCollaborators } from "@/lib/portal-config";
import { recordModuleUpdateSafely } from "@/lib/module-updates";
import {
  listAvisoLeituras,
  registerAvisoLeitura,
} from "@/lib/aviso-leituras";

const ADMIN_EMAIL = "mcrodini@gmail.com";
const MANAGEMENT_EMAILS = new Set([ADMIN_EMAIL, "mrodini@gmail.com"]);
const ARARAS_EMAILS = new Set([
  "estoqueararascasatimoni@gmail.com",
  "comercialara@casatimoni.com.br",
  "fotoscasatimoni@gmail.com",
  "reginaldo@casatimoni.com.br",
  "casatimoniararas@gmail.com",
]);

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function allowedUnit(email: string, portalUser?: PortalUser | null) {
  if (portalUser?.unit) return portalUser.unit;
  if (MANAGEMENT_EMAILS.has(email)) return "geral";
  return ARARAS_EMAILS.has(email) ? "Araras" : "Rio Claro";
}

async function context() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email || !getPortalUser(email, session?.portalUser) || !session?.accessToken) return null;
  return { email, accessToken: session.accessToken, portalUser: session.portalUser };
}

export async function GET() {
  const current = await context();
  if (!current) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });

  try {
    const [reads, collaborators] = await Promise.all([
      listAvisoLeituras(current.accessToken),
      getEffectiveCollaborators(current.accessToken),
    ]);
    const employees = collaborators.filter((member) => member.noticeRequired).map((member) => ({ employee: member.name, unit: member.unit, pinConfigured: true }));
    const unit = allowedUnit(current.email, current.portalUser);
    return NextResponse.json({
      ok: true,
      reads: unit === "geral" ? reads : reads.filter((read) => read.unit === unit),
      employees: unit === "geral" ? employees : employees.filter((employee) => employee.unit === unit),
    });
  } catch (error) {
    console.error("[avisos-leituras][GET]", error);
    return NextResponse.json({ error: "Não foi possível carregar as leituras." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const current = await context();
  if (!current) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });

  try {
    const body = await request.json();
    const employee = String(body?.employee ?? "").trim();
    const unit = String(body?.unit ?? "").trim();
    const pin = String(body?.pin ?? "").trim();

    const collaborators = await getEffectiveCollaborators(current.accessToken);
    if (!collaborators.some((member) => member.name === employee && member.unit === unit && member.noticeRequired)) {
      return NextResponse.json({ error: "Selecione um funcionário válido." }, { status: 400 });
    }
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "A senha deve ter 4 números." }, { status: 400 });
    }

    const permittedUnit = allowedUnit(current.email, current.portalUser);
    if (permittedUnit !== "geral" && unit !== permittedUnit) {
      return NextResponse.json({ error: "Funcionário fora da unidade deste acesso." }, { status: 403 });
    }

    const avisoId = String(body?.avisoId ?? "").trim();
    if (!avisoId) return NextResponse.json({ error: "Aviso inválido." }, { status: 400 });
    const notices = await listComunicados(current.accessToken);
    const notice = notices.find((item) => item.id === avisoId && item.status === "ativo");
    if (!notice) return NextResponse.json({ error: "Aviso não encontrado ou encerrado." }, { status: 404 });
    const noticeUnit = notice.unit === "rio claro" ? "Rio Claro" : notice.unit === "araras" ? "Araras" : "geral";
    if (noticeUnit !== "geral" && noticeUnit !== unit) {
      return NextResponse.json({ error: "Este aviso não pertence à unidade selecionada." }, { status: 403 });
    }
    const result = await registerAvisoLeitura(current.accessToken, {
      avisoId,
      employee,
      unit,
      pin,
      title: notice.title,
      portalEmail: current.email,
    });
    if (!result.alreadyRegistered) {
      await recordModuleUpdateSafely("avisos", current.email, `${employee} confirmou a leitura de ${notice.title}.`);
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar a leitura.";
    console.error("[avisos-leituras][POST]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
