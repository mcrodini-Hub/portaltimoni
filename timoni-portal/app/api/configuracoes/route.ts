import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeEmail, type PortalBox, type PortalModule, type PortalUser } from "@/lib/access-control";
import {
  appendAudit,
  CICA_EMAIL,
  deleteCollaborator,
  deletePortalUser,
  loadPortalConfiguration,
  upsertCollaborator,
  upsertPortalUser,
  type ConfiguredCollaborator,
} from "@/lib/portal-config";

const VALID_MODULES = new Set<PortalModule>([
  "painel", "agenda", "agenda-ct", "chat", "compras", "conferencia", "estoque", "estoque-rotativo", "motorista", "reunioes", "leads",
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
    const body = await request.json();
    if (body.kind === "user") {
      const email = normalizeEmail(String(body.email || ""));
      if (!email || email === CICA_EMAIL) return NextResponse.json({ error: "Este acesso não pode ser excluído." }, { status: 400 });
      const configuration = await loadPortalConfiguration(current.accessToken);
      const user = configuration.users.find((item) => item.email === email);
      if (!user) return NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });
      await deletePortalUser(current.accessToken, email);
      await appendAudit(current.accessToken, "Acesso excluído", `${user.accessLabel || user.name} · ${email}`, current.email);
      return NextResponse.json({ ok: true });
    }

    const id = String(body.id || "");
    if (!id.trim()) return NextResponse.json({ error: "Colaborador inválido." }, { status: 400 });
    const configuration = await loadPortalConfiguration(current.accessToken);
    const member = configuration.collaborators.find((item) => item.id === id);
    if (!member) return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });
    await deleteCollaborator(current.accessToken, id);
    await appendAudit(current.accessToken, "Colaborador excluído", `${member.name} · ${member.unit}`, current.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[configuracoes][DELETE]", error);
    return NextResponse.json({ error: "Não foi possível concluir a exclusão." }, { status: 500 });
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
    accessLabel: String(value.accessLabel || name).trim().slice(0, 80) || name,
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
  const access = accessEmail ? users.find((user) => user.email === accessEmail) : null;
  if (accessEmail && !access) throw new Error("Selecione um acesso válido para este colaborador.");
  const name = String(value.name || "").trim();
  const unit = String(value.unit) === "Araras" ? "Araras" : String(value.unit) === "Rio Claro" ? "Rio Claro" : null;
  if (name.length < 2 || !unit) throw new Error("Informe nome e unidade válidos para o colaborador.");
  const id = String(value.id || `${unit}-${name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  return {
    id,
    accessEmail,
    name,
    unit,
    active: value.active !== false,
    noticeRequired: value.noticeRequired !== false,
    chatEnabled: value.chatEnabled !== false,
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
      await upsertPortalUser(current.accessToken, item);
      await appendAudit(current.accessToken, "Acesso atualizado", `${item.accessLabel || item.name} · ${item.email}`, current.email);
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
