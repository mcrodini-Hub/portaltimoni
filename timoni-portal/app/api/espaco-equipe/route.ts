import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appendTeamMessage } from "@/lib/espaco-equipe";
import { findTeamMember } from "@/lib/team-members";

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

    if (!findTeamMember(employee, unit)) {
      return NextResponse.json({ error: "Selecione um funcionário válido." }, { status: 400 });
    }

    if (message.length < 3) {
      return NextResponse.json({ error: "Escreva a mensagem antes de registrar." }, { status: 400 });
    }

    if (message.length > 2500) {
      return NextResponse.json({ error: "A mensagem deve ter no máximo 2.500 caracteres." }, { status: 400 });
    }

    await appendTeamMessage({ employee, unit, message });
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
