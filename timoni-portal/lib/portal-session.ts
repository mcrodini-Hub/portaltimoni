import { cache } from "react";
import { auth } from "@/lib/auth";

// Compartilha apenas a leitura da sessão dentro da renderização atual.
// Uma nova requisição continua verificando a revisão das permissões.
export const getPortalSession = cache(async () => auth());
