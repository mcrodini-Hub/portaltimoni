import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPortalUser, type PortalUser } from "@/lib/access-control";
import { canViewComunicado, listComunicados } from "@/lib/comunicados";
import { getEffectiveCollaborators, listConfiguredPortalUsers } from "@/lib/portal-config";
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
  // Ciça e Marcelo são sempre gestão geral. Essa regra vem antes da unidade
  // salva na configuração para evitar que um valor antigo de sessão/planilha
  // filtre as leituras já registradas de uma das lojas.
  if (MANAGEMENT_EMAILS.has(email)) return "geral";
  if (portalUser?.unit) return portalUser.unit;
  return ARARAS_EMAILS.has(email) ? "Araras" : "Rio Claro";
}

async function context() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email || !getPortalUser(email, session?.portalUser)) return null;
  return { email, accessToken: session?.accessToken ?? "", portalUser: session?.portalUser };
}

export async function GET() {
  const current = await context();
  if (!current) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });

  try {
    const [reads, collaborators, notices, users] = await Promise.all([
      listAvisoLeituras(current.accessToken),
      getEffectiveCollaborators(current.accessToken),
      listComunicados(current.accessToken),
      listConfiguredPortalUsers(current.accessToken),
    ]);
    const confirmationAccesses = new Set(users.filter((user) => user.active !== false && user.noticeRequired).map((user) => normalizeEmail(user.email)));
    const unit = allowedUnit(current.email, current.portalUser);
    const currentUnit = unit === "Araras" ? "araras" : unit === "Rio Claro" ? "rio claro" : "geral";
    const visibleNotices = notices.filter((item) => MANAGEMENT_EMAILS.has(current.email) || canViewComunicado(item, current.email, currentUnit));
    const completedAvisoIds = visibleNotices.filter((notice) => {
      const targetedAccesses = Array.isArray(notice.recipientEmails)
        ? new Set(notice.recipientEmails.map(normalizeEmail))
        : null;
      const audience = collaborators.filter((member) => {
        if (!member.active || !confirmationAccesses.has(normalizeEmail(member.accessEmail))) return false;
        if (targetedAccesses) return targetedAccesses.has(normalizeEmail(member.accessEmail));
        if (notice.unit === "geral") return true;
        return notice.unit === "araras" ? member.unit === "Araras" : member.unit === "Rio Claro";
      });
      if (audience.length === 0) return false;
      const readMembers = new Set(
        reads.filter((read) => read.avisoId === notice.id).map((read) => `${read.unit}::${read.employee}`),
      );
      return audience.every((member) => readMembers.has(`${member.unit}::${member.name}`));
    }).map((notice) => notice.id);
    return NextResponse.json({ ok: true, completedAvisoIds });
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

    const [collaborators, users] = await Promise.all([
      getEffectiveCollaborators(current.accessToken),
      listConfiguredPortalUsers(current.accessToken),
    ]);
    const confirmationAccesses = new Set(users.filter((user) => user.active !== false && user.noticeRequired).map((user) => normalizeEmail(user.email)));
    if (!collaborators.some((member) => member.name === employee && member.unit === unit && member.active && confirmationAccesses.has(normalizeEmail(member.accessEmail)))) {
      return NextResponse.json({ error: "Selecione um funcionário válido." }, { status: 400 });
    }
    const permittedUnit = allowedUnit(current.email, current.portalUser);
    if (permittedUnit !== "geral" && unit !== permittedUnit) {
      return NextResponse.json({ error: "Funcionário fora da unidade deste acesso." }, { status: 403 });
    }

    const avisoId = String(body?.avisoId ?? "").trim();
    if (!avisoId) return NextResponse.json({ error: "Aviso inválido." }, { status: 400 });
    const notices = await listComunicados(current.accessToken);
    const currentUnit = permittedUnit === "Araras" ? "araras" : permittedUnit === "Rio Claro" ? "rio claro" : "geral";
    const notice = notices.find((item) => item.id === avisoId && item.status === "ativo" && (MANAGEMENT_EMAILS.has(current.email) || canViewComunicado(item, current.email, currentUnit)));
    if (!notice) return NextResponse.json({ error: "Aviso não encontrado ou encerrado." }, { status: 404 });
    const noticeUnit = notice.unit === "rio claro" ? "Rio Claro" : notice.unit === "araras" ? "Araras" : "geral";
    if (noticeUnit !== "geral" && noticeUnit !== unit) {
      return NextResponse.json({ error: "Este aviso não pertence à unidade selecionada." }, { status: 403 });
    }
    const result = await registerAvisoLeitura(current.accessToken, {
      avisoId,
      employee,
      unit,
      title: notice.title,
      portalEmail: current.email,
    });
    if (!result.alreadyRegistered) {
      await recordModuleUpdateSafely(
        "avisos",
        current.email,
        `${employee} confirmou a leitura de ${notice.title}.`,
        `aviso-leitura:${avisoId}:${unit}:${employee}`,
      );
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar a leitura.";
    console.error("[avisos-leituras][POST]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
