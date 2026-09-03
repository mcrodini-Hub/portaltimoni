import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appendTeamMessage, listTeamMessages } from "@/lib/espaco-equipe";

const GESTAO_EMAILS = new Set(["mcrodini@gmail.com", "mrodini@gmail.com"]);
const FINAL_STATUSES = new Set(["concluido", "concluído", "resolvido", "feito", "finalizado"]);

export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? "";

  if (!GESTAO_EMAILS.has(email)) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  try {
    const messages = await listTeamMessages();
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
    const message = String(body?.message ?? "").trim();

    if (message.length < 3) {
      return NextResponse.json({ error: "Escreva a mensagem antes de registrar." }, { status: 400 });
    }

    if (message.length > 2500) {
      return NextResponse.json({ error: "A mensagem deve ter no máximo 2.500 caracteres." }, { status: 400 });
    }

    await appendTeamMessage({ message });
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
