import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appendTeamMessage, listTeamMessages } from "@/lib/espaco-equipe";
import { getEffectiveCollaborators } from "@/lib/portal-config";

const GESTAO_EMAILS = new Set(["mcrodini@gmail.com", "mrodini@gmail.com"]);
const FINAL_STATUSES = new Set(["concluido", "concluído", "resolvido", "feito", "finalizado"]);

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? "";

  if (!GESTAO_EMAILS.has(email)) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  try {
    if (!session?.accessToken) throw new Error("Sessão Google sem credencial de acesso.");
    const messages = await listTeamMessages(session.accessToken);
    const pending = messages.filter((item) => {
      const status = item.status.trim().toLowerCase();
      return !FINAL_STATUSES.has(status);
    }).length;

    return NextResponse.json({ pending });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar as pendências." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const employee = String(body?.employee ?? "").trim();
    const unit = String(body?.unit ?? "").trim();
    const message = String(body?.message ?? "").trim();

    if (!session.accessToken) throw new Error("Sessão Google sem credencial de acesso.");
    const collaborators = await getEffectiveCollaborators(session.accessToken);
    if (!collaborators.some((member) => member.name === employee && member.unit === unit)) {
      return NextResponse.json({ error: "Selecione um funcionário válido." }, { status: 400 });
    }

    if (message.length < 3) {
      return NextResponse.json({ error: "Escreva a mensagem antes de registrar." }, { status: 400 });
    }

    if (message.length > 2500) {
      return NextResponse.json({ error: "A mensagem deve ter no máximo 2.500 caracteres." }, { status: 400 });
    }

    await appendTeamMessage({ employee, unit, message }, session.accessToken);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[Painel Timoni] Espaço Equipe / envio: ${error.name}: ${error.message}`);
    } else {
      console.error("[Painel Timoni] Espaço Equipe / envio: falha desconhecida");
    }

    return NextResponse.json(
      { error: "Não foi possível registrar agora. Tente novamente." },
      { status: 500 },
    );
  }
}
