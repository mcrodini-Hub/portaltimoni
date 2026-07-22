import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Segunda camada de defesa (a primeira é o callback signIn em lib/auth.ts):
// toda rota de API reconfirma sessão, autorização e validade do token antes
// de chamar a Calendar API.
export async function requireAuthorizedSession() {
  const session = await auth();

  if (!session?.user?.email || session.user.email !== process.env.AUTHORIZED_EMAIL) {
    return {
      session: null,
      errorResponse: NextResponse.json({ error: "Não autorizado." }, { status: 401 }),
    };
  }

  if (session.error === "RefreshAccessTokenError" || !session.accessToken) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: "Sessão expirada. Faça login novamente." },
        { status: 401 }
      ),
    };
  }

  return { session, errorResponse: null };
}
