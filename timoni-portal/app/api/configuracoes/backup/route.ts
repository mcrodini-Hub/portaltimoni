import JSZip from "jszip";
import { auth } from "@/lib/auth";
import { normalizeEmail, type PortalUser } from "@/lib/access-control";
import { listComunicados, replaceComunicados, type Comunicado } from "@/lib/comunicados";
import { listAvisoLeituras, replaceAvisoLeituras, type AvisoLeitura } from "@/lib/aviso-leituras";
import { listTeamMessages, replaceTeamMessages, type TeamMessage } from "@/lib/espaco-equipe";
import {
  appendAudit,
  CICA_EMAIL,
  defaultPortalUsers,
  loadPortalConfiguration,
  writeCollaborators,
  writeUsers,
  type ConfiguredCollaborator,
} from "@/lib/portal-config";

export const runtime = "nodejs";
const SCHEMA_VERSION = 1;

type PortalBackup = {
  schemaVersion: number;
  portal: "Portal Timoni";
  exportedAt: string;
  users: PortalUser[];
  collaborators: ConfiguredCollaborator[];
  notices: Comunicado[];
  noticeReads: AvisoLeitura[];
  teamMessages: TeamMessage[];
};

async function adminContext() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (email !== CICA_EMAIL || !session?.accessToken) return null;
  return { email, accessToken: session.accessToken };
}

async function createBackup(accessToken: string): Promise<PortalBackup> {
  const [configuration, notices, noticeReads, teamMessages] = await Promise.all([
    loadPortalConfiguration(accessToken),
    listComunicados(accessToken),
    listAvisoLeituras(accessToken),
    listTeamMessages(accessToken),
  ]);
  return {
    schemaVersion: SCHEMA_VERSION,
    portal: "Portal Timoni",
    exportedAt: new Date().toISOString(),
    users: configuration.users,
    collaborators: configuration.collaborators,
    notices,
    noticeReads,
    teamMessages,
  };
}

function validateBackup(value: unknown): asserts value is PortalBackup {
  const backup = value as Partial<PortalBackup>;
  if (
    !backup || backup.schemaVersion !== SCHEMA_VERSION || backup.portal !== "Portal Timoni" ||
    !Array.isArray(backup.users) || !Array.isArray(backup.collaborators) ||
    !Array.isArray(backup.notices) || !Array.isArray(backup.noticeReads) || !Array.isArray(backup.teamMessages)
  ) throw new Error("O arquivo não é um backup válido do Portal Timoni.");
}

export async function GET() {
  const current = await adminContext();
  if (!current) return Response.json({ error: "Acesso exclusivo da Ciça." }, { status: 403 });
  try {
    const backup = await createBackup(current.accessToken);
    const zip = new JSZip();
    zip.file("portal-timoni-backup.json", JSON.stringify(backup, null, 2));
    zip.file("LEIA-ME.txt", `Backup do Portal Timoni\nGerado em: ${backup.exportedAt}\nImporte este arquivo ZIP somente pela área Configurações > Backup.`);
    const content = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    await appendAudit(current.accessToken, "Backup gerado", backup.exportedAt, current.email);
    return new Response(new Uint8Array(content), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="portal-timoni-backup-${backup.exportedAt.slice(0, 10)}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[configuracoes][backup][GET]", error);
    return Response.json({ error: "Não foi possível gerar o backup." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const current = await adminContext();
  if (!current) return Response.json({ error: "Acesso exclusivo da Ciça." }, { status: 403 });
  try {
    const formData = await request.formData();
    const file = formData.get("backup");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".zip")) {
      return Response.json({ error: "Selecione um arquivo ZIP do Portal Timoni." }, { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) return Response.json({ error: "O backup excede o limite de 15 MB." }, { status: 400 });
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entry = zip.file("portal-timoni-backup.json");
    if (!entry) throw new Error("Conteúdo principal do backup não encontrado.");
    const backup = JSON.parse(await entry.async("string")) as unknown;
    validateBackup(backup);

    const cicaDefault = defaultPortalUsers().find((user) => user.email === CICA_EMAIL)!;
    const users = backup.users.some((user) => normalizeEmail(user.email) === CICA_EMAIL) ? backup.users : [...backup.users, cicaDefault];
    await writeUsers(current.accessToken, users);
    await writeCollaborators(current.accessToken, backup.collaborators);
    await replaceComunicados(current.accessToken, backup.notices);
    await replaceAvisoLeituras(current.accessToken, backup.noticeReads);
    await replaceTeamMessages(current.accessToken, backup.teamMessages);
    await appendAudit(current.accessToken, "Backup restaurado", `${file.name} · gerado em ${backup.exportedAt}`, current.email);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[configuracoes][backup][POST]", error);
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível restaurar o backup." }, { status: 400 });
  }
}
