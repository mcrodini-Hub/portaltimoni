import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeEmail, type PortalModule, type PortalUser } from "@/lib/access-control";
import {
  appendAudit,
  CICA_EMAIL,
  loadPortalConfiguration,
  writeCollaborators,
  writeUsers,
  type ConfiguredCollaborator,
} from "@/lib/portal-config";

const VALID_MODULES = new Set<PortalModule>([
  "painel", "agenda", "compras", "conferencia", "estoque", "motorista", "reunioes", "leads", "marketing", "financeiro",
]);

async function adminContext() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (email !== CICA_EMAIL || !session?.accessToken) return null;
  return { email, accessToken: session.accessToken };
}

function cleanModules(value: unknown): PortalModule[] {
  return Array.isArray(value) ? value.filter((item): item is PortalModule => VALID_MODULES.has(item as PortalModule)) : [];
}

function cleanUser(value: Record<string, unknown>): PortalUser {
  const email = normalizeEmail(String(value.email || ""));
  const name = String(value.name || "").trim();
  if (!email.includes("@") || name.length < 2) throw new Error("Informe nome e e-mail válidos.");
  const modules = cleanModules(value.modules);
  const boxes = cleanModules(value.boxes).filter((module) => modules.includes(module));
  return {
    email,
    name,
    unit: ["Geral", "Araras", "Rio Claro"].includes(String(value.unit)) ? value.unit as PortalUser["unit"] : "Rio Claro",
    modules,
    boxes,
    requiresPassword: Boolean(value.requiresPassword),
    readOnly: Boolean(value.readOnly),
    active: email === CICA_EMAIL ? true : value.active !== false,
    directPainel: Boolean(value.directPainel),
    lastAccess: String(value.lastAccess || ""),
  };
}

function cleanCollaborator(value: Record<string, unknown>): ConfiguredCollaborator {
  const name = String(value.name || "").trim();
  const unit = String(value.unit || "");
  if (name.length < 2 || !["Araras", "Rio Claro"].includes(unit)) throw new Error("Informe nome e unidade válidos.");
  const id = String(value.id || `${unit}-${name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  return {
    id,
    name,
    unit: unit as ConfiguredCollaborator["unit"],
    active: value.active !== false,
    noticeRequired: value.noticeRequired !== false,
    updatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  const current = await adminContext();
  if (!current) return NextResponse.json({ error: "Acesso exclusivo da Ciça." }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...(await loadPortalConfiguration(current.accessToken)) });
  } catch (error) {
    console.error("[configuracoes][GET]", error);
    return NextResponse.json({ error: "Não foi possível carregar as configurações." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const current = await adminContext();
  if (!current) return NextResponse.json({ error: "Acesso exclusivo da Ciça." }, { status: 403 });
  try {
    const body = await request.json();
    const configuration = await loadPortalConfiguration(current.accessToken);

    if (body.section === "user") {
      const item = cleanUser(body.item || {});
      const users = configuration.users.filter((user) => user.email !== item.email);
      users.push(item);
      await writeUsers(current.accessToken, users);
      await appendAudit(current.accessToken, "Acesso atualizado", `${item.name} · ${item.email}`, current.email);
    } else if (body.section === "collaborator") {
      const item = cleanCollaborator(body.item || {});
      const collaborators = configuration.collaborators.filter((member) => member.id !== item.id);
      collaborators.push(item);
      await writeCollaborators(current.accessToken, collaborators);
      await appendAudit(current.accessToken, "Colaborador atualizado", `${item.name} · ${item.unit}`, current.email);
    } else {
      return NextResponse.json({ error: "Alteração inválida." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[configuracoes][PUT]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar." }, { status: 400 });
  }
}
