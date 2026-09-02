import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasModuleAccess, type PortalModule } from "@/lib/access-control";

const protectedRoutes: Array<{ prefix: string; module: PortalModule }> = [
  { prefix: "/agenda", module: "agenda" },
  { prefix: "/colaboradores", module: "painel" },
  { prefix: "/dashboard/compras", module: "compras" },
  { prefix: "/dashboard/conferencia-pedidos", module: "conferencia" },
  { prefix: "/dashboard/estoque", module: "estoque" },
  { prefix: "/dashboard/motorista-leitura", module: "motorista" },
  { prefix: "/dashboard/motorista", module: "motorista" },
  { prefix: "/dashboard/reunioes", module: "reunioes" },
  { prefix: "/dashboard/leads", module: "leads" },
  { prefix: "/dashboard/marketing", module: "marketing" },
  { prefix: "/dashboard/financeiro", module: "financeiro" },
  { prefix: "/agenda-motorista", module: "motorista" },
  { prefix: "/espaco-equipe", module: "painel" },
  { prefix: "/motorista", module: "motorista" },
];

const publicMotoristaAssets = new Set([
  "/motorista/app.css",
  "/motorista/app.js",
  "/motorista/lib/store.js",
  "/motorista/icons/icon48.png",
  "/agenda-motorista/app.css",
  "/agenda-motorista/app.js",
  "/agenda-motorista/lib/store.js",
]);

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  const configuredUser = request.auth?.portalUser;

  // A tela pública do motorista continua disponível para uso direto no celular.
  if (pathname === "/motorista" || pathname.startsWith("/motorista/")) {
    return NextResponse.next();
  }

  if (publicMotoristaAssets.has(pathname)) {
    return NextResponse.next();
  }

  if (!request.auth?.user?.email) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/configuracoes") && request.auth.user.email.trim().toLowerCase() !== "mcrodini@gmail.com") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const protectedRoute = protectedRoutes.find(({ prefix }) => pathname.startsWith(prefix));

  if (protectedRoute && !hasModuleAccess(request.auth.user.email, protectedRoute.module, configuredUser)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/agenda/:path*",
    "/colaboradores/:path*",
    "/espaco-equipe/:path*",
    "/motorista/:path*",
    "/agenda-motorista/:path*",
    "/api/conferencia-pedidos",
    "/configuracoes/:path*",
  ],
};
