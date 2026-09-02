import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAuthorizedUser } from "@/lib/access-control";
import { getAccessTokenFromRefreshToken } from "@/lib/google-calendar";

// A sessão identifica o usuário e suas permissões. O token central do Portal
// mantém as integrações Google funcionando sem encerrar o acesso do colaborador.
export async function requireAuthorizedSession() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email || !isAuthorizedUser(email, session?.portalUser)) {
    return {
      session: null,
      errorResponse: NextResponse.json({ error: "Não autorizado." }, { status: 401 }),
    };
  }

  if (session.error === "RefreshAccessTokenError" || !session.accessToken) {
    try {
      session.accessToken = await getAccessTokenFromRefreshToken();
      session.error = undefined;
    } catch (error) {
      console.error("[auth-guard] Integração Google temporariamente indisponível.", error);
      return {
        session: null,
        errorResponse: NextResponse.json(
          { error: "Integração Google temporariamente indisponível. Tente novamente." },
          { status: 503 },
        ),
      };
    }
  }

  return { session, errorResponse: null };
}
