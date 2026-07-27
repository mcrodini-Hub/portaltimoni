import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { requireAuthorizedSession } from "@/lib/auth-guard";

// Utilitário de configuração (não faz parte do fluxo normal do portal): mostra o
// refresh_token da sessão atual, uma única vez, para o dono do portal copiar e colar em
// GOOGLE_REFRESH_TOKEN (env var) — necessário para a rota pública /api/public/agenda-resumo
// conseguir falar com o Google Calendar sem depender de um navegador logado.
//
// Protegida pela mesma checagem de sessão das outras rotas — só quem já está logado como
// AUTHORIZED_EMAIL consegue chamar, e o valor devolvido é o refresh_token da própria pessoa.
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAuthorizedSession();
  if (errorResponse) return errorResponse;

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.refreshToken) {
    return NextResponse.json(
      {
        error:
          "Sessão atual não tem refresh_token (o Google só emite na primeira autorização). " +
          "Revogue o acesso do app em https://myaccount.google.com/permissions e faça login de novo."
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ refreshToken: token.refreshToken });
}
