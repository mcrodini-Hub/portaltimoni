import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeEmail, type PortalBox, type PortalModule, type PortalUser } from "@/lib/access-control";
import {
  appendAudit,
  CICA_EMAIL,
  deleteCollaborator,
  loadPortalConfiguration,
  upsertCollaborator,
  upsertPortalUser,
  type ConfiguredCollaborator,
} from "@/lib/portal-config";

const VALID_MODULES = new Set<PortalModule>([
  "painel", "agenda", "chat", "compras", "conferencia", "estoque", "estoque-rotativo", "motorista", "reunioes", "leads", "marketing", "financeiro",
]);
const VALID_BOXES = new Set<PortalBox>([
  "painel", "agenda", "compras", "conferencia", "estoque", "estoque-rotativo", "motorista", "reunioes", "leads", "espaco-equipe",
]);
const MANAGEMENT_EMAILS = new Set([CICA_EMAIL, "mrodini@gmail.com"]);

async function adminContext() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!MANAGEMENT_EMAILS.has(email) || !session?.accessToken) return null;
  return { email, accessToken: session.accessToken };
}

export async function DELETE(request: Request) {
  const current = await adminContext();
  if (!current) return NextResponse.json({ error: "Acesso exclusivo da gestão." }, { status: 403 });
  try {
    const { id } = await request.json();
    if (typeof id !== "string" || !id.trim()) return NextResponse.json({ error: "Colaborador inválido." }, { status: 400 });
    const configuration = await loadPortalConfiguration(current.accessToken);
    const member = configuration.collaborators.find((item) => item.id === id);
    if (!member) return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });
    await deleteCollaborator(current.accessToken, id);
    await appendAudit(current.accessToken, "Colaborador excluído", `${member.name} · ${member.unit}`, current.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[configuracoes][DELETE]", error);
    return NextResponse.json({ error: "Não foi possível excluir o colaborador." }, { status: 500 });
  }
}

function cleanModules(value: unknown): PortalModule[] {
  return Array.isArray(value) ? value.filter((item): item is PortalModule => VALID_MODULES.has(item as PortalModule)) : [];
}

function cleanBoxes(value: unknown): PortalBox[] {
  return Array.isArray(value) ? value.filter((item): item is PortalBox => VALID_BOXES.has(item as PortalBox)) : [];
}

function cleanUser(value: Record<string, unknown>): PortalUser {
  const email = normalizeEmail(String(value.email || ""));
  const name = String(value.name || "").trim();
  if (!email.includes("@") || name.length < 2) throw new Error("Informe nome e e-mail válidos.");
  const modules = cleanModules(value.modules);
  const boxes = cleanBoxes(value.boxes).filter((box) => box === "espaco-equipe" ? modules.includes("painel") : modules.includes(box));
  return {
    email,
    name,
    unit: ["Geral", "Araras", "Rio Claro"].includes(String(value.unit)) ? value.unit as PortalUser["unit"] : "Rio Claro",
    modules,
    boxes,
    mobileModules: Array.isArray(value.mobileModules) ? cleanModules(value.mobileModules).filter((module) => modules.includes(module)) : undefined,
    requiresPassword: Boolean(value.requiresPassword),
    readOnly: Boolean(value.readOnly),
    active: email === CICA_EMAIL ? true : value.active !== false,
    directPainel: Boolean(value.directPainel),
    lastAccess: String(value.lastAccess || ""),
  };
}

function cleanCollaborator(value: Record<string, unknown>, users: PortalUser[]): ConfiguredCollaborator {
  const accessEmail = normalizeEmail(String(value.accessEmail || ""));
  const access = users.find((user) => user.email === accessEmail);
  if (!access) throw new Error("Selecione um acesso válido para este colaborador.");
  if (!["Araras", "Rio Claro"].includes(access.unit)) throw new Error("O acesso precisa estar vinculado a Rio Claro ou Araras.");
  const id = String(value.id || accessEmail.replace(/[^a-z0-9]+/g, "-"));
  return {
    id,
    accessEmail,
    name: access.name,
    unit: access.unit as ConfiguredCollaborator["unit"],
    active: value.active !== false,
    noticeRequired: value.noticeRequired !== false,
    updatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  const current = await adminContext();
  if (!current) return NextResponse.json({ error: "Acesso exclusivo da gestão." }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...(await loadPortalConfiguration(current.accessToken)) });
  } catch (error) {
    console.error("[configuracoes][GET]", error);
    return NextResponse.json({ error: "Não foi possível carregar as configurações." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const current = await adminContext();
  if (!current) return NextResponse.json({ error: "Acesso exclusivo da gestão." }, { status: 403 });
  try {
    const body = await request.json();
    if (body.section === "user") {
      const item = cleanUser(body.item || {});
      const configuration = await loadPortalConfiguration(current.accessToken);
      const linked = configuration.collaborators.find((member) => member.accessEmail === item.email);
      await Promise.all([
        upsertPortalUser(current.accessToken, item),
        linked ? upsertCollaborator(current.accessToken, {
          ...linked,
          name: item.name,
          unit: item.unit === "Araras" ? "Araras" : "Rio Claro",
          active: item.active !== false,
          updatedAt: new Date().toISOString(),
        }) : Promise.resolve(null),
        appendAudit(current.accessToken, "Acesso atualizado", `${item.name} · ${item.email}`, current.email),
      ]);
      return NextResponse.json({ ok: true, item });
    } else if (body.section === "collaborator") {
      const configuration = await loadPortalConfiguration(current.accessToken);
      const item = cleanCollaborator(body.item || {}, configuration.users);
      await Promise.all([
        upsertCollaborator(current.accessToken, item),
        appendAudit(current.accessToken, "Colaborador atualizado", `${item.name} · ${item.unit} · ${item.accessEmail}`, current.email),
      ]);
      return NextResponse.json({ ok: true, item });
    } else {
      return NextResponse.json({ error: "Alteração inválida." }, { status: 400 });
    }

  } catch (error) {
    console.error("[configuracoes][PUT]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar." }, { status: 400 });
  }
}
