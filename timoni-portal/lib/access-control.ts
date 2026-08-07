export type PortalModule =
  | "painel"
  | "agenda"
  | "compras"
  | "conferencia"
  | "estoque"
  | "motorista"
  | "reunioes"
  | "marketing"
  | "financeiro";

type PortalUser = {
  name: string;
  email: string;
  modules: PortalModule[];
  requiresPassword: boolean;
};

const allModules: PortalModule[] = [
  "painel",
  "agenda",
  "compras",
  "conferencia",
  "estoque",
  "motorista",
  "reunioes",
  "marketing",
  "financeiro",
];

function withStock(modules: PortalModule[]): PortalModule[] {
  return Array.from(new Set<PortalModule>([...modules, "estoque"]));
}

export const portalUsers: Record<string, PortalUser> = {
  "mcrodini@gmail.com": {
    name: "Ciça Rodini",
    email: "mcrodini@gmail.com",
    modules: allModules,
    requiresPassword: true,
  },
  "mrodini@gmail.com": {
    name: "Marcelo Rodini",
    email: "mrodini@gmail.com",
    modules: withStock(allModules.filter((module) => module !== "agenda")),
    requiresPassword: true,
  },
  "carolina@casatimoni.com.br": {
    name: "Carolina - Financeiro Rio Claro",
    email: "carolina@casatimoni.com.br",
    modules: withStock(["painel", "financeiro"]),
    requiresPassword: true,
  },
  "comercialrc@casatimoni.com.br": {
    name: "Jeovana - Rio Claro",
    email: "comercialrc@casatimoni.com.br",
    modules: withStock(["painel", "marketing", "motorista", "financeiro"]),
    requiresPassword: true,
  },
  "reginaldo@casatimoni.com.br": {
    name: "Reginaldo - Araras",
    email: "reginaldo@casatimoni.com.br",
    modules: withStock(["painel", "motorista", "financeiro"]),
    requiresPassword: true,
  },
  "comercialara@casatimoni.com.br": {
    name: "Carolina - Vendas Araras",
    email: "comercialara@casatimoni.com.br",
    modules: withStock(["painel", "marketing"]),
    requiresPassword: false,
  },
  "casatimoniararas@gmail.com": {
    name: "Casa Timoni Araras",
    email: "casatimoniararas@gmail.com",
    modules: withStock(["painel", "marketing"]),
    requiresPassword: false,
  },
  "marketplacerc.mcr@gmail.com": {
    name: "Jaqueline - Marketplace Rio Claro",
    email: "marketplacerc.mcr@gmail.com",
    modules: withStock(["painel", "marketing", "motorista"]),
    requiresPassword: false,
  },
  "estoquetimoni@gmail.com": {
    name: "Lucas - Estoque Rio Claro",
    email: "estoquetimoni@gmail.com",
    modules: withStock(["painel"]),
    requiresPassword: false,
  },
  "fotoscasatimoni@gmail.com": {
    name: "Lucas e Vendedores - Araras",
    email: "fotoscasatimoni@gmail.com",
    modules: withStock(["painel"]),
    requiresPassword: false,
  },
  "balcaotimoni@gmail.com": {
    name: "Vendedores - Rio Claro",
    email: "balcaotimoni@gmail.com",
    modules: withStock(["painel"]),
    requiresPassword: false,
  },
  "caixatimonirioclaro@gmail.com": {
    name: "Thais - Rio Claro",
    email: "caixatimonirioclaro@gmail.com",
    modules: withStock(["painel", "motorista"]),
    requiresPassword: false,
  },
};

export function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

export function isAuthorizedUser(email?: string | null) {
  return Boolean(portalUsers[normalizeEmail(email)]);
}

export function getPortalUser(email?: string | null) {
  return portalUsers[normalizeEmail(email)] ?? null;
}

export function hasModuleAccess(email: string | null | undefined, module: PortalModule) {
  return getPortalUser(email)?.modules.includes(module) ?? false;
}
