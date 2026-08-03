import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasModuleAccess, type PortalModule } from "@/lib/access-control";

const protectedRoutes: Array<{ prefix: string; module: PortalModule }> = [
  { prefix: "/agenda", module: "agenda" },
  { prefix: "/colaboradores", module: "painel" },
  { prefix: "/dashboard/compras", module: "compras" },
  { prefix: "/dashboard/conferencia-pedidos", module: "conferencia" },
  { prefix: "/dashboard/estoque", module: "estoque" },
  { prefix: "/dashboard/reunioes", module: "reunioes" },
  { prefix: "/dashboard/marketing", module: "marketing" },
  { prefix: "/dashboard/financeiro", module: "financeiro" },
];

export default auth((request) => {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/api/conferencia-pedidos") {
    return NextResponse.rewrite(new URL("/api/conferencia-gratis", request.url));
  }

  if (!request.auth?.user?.email) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const protectedRoute = protectedRoutes.find(({ prefix }) => pathname.startsWith(prefix));

  if (protectedRoute && !hasModuleAccess(request.auth.user.email, protectedRoute.module)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/agenda/:path*",
    "/colaboradores/:path*",
    "/api/conferencia-pedidos",
  ],
};
