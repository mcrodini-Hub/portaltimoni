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
    modules: allModules.filter((module) => module !== "agenda"),
    requiresPassword: true,
  },
  "carolina@casatimoni.com.br": {
    name: "Carolina - Financeiro Rio Claro",
    email: "carolina@casatimoni.com.br",
    modules: ["painel", "financeiro"],
    requiresPassword: true,
  },
  "comercialrc@casatimoni.com.br": {
    name: "Jeovana - Rio Claro",
    email: "comercialrc@casatimoni.com.br",
    modules: ["painel", "estoque", "marketing", "reunioes", "motorista", "financeiro"],
    requiresPassword: true,
  },
  "reginaldo@casatimoni.com.br": {
    name: "Reginaldo - Araras",
    email: "reginaldo@casatimoni.com.br",
    modules: ["painel", "estoque", "reunioes", "motorista", "financeiro"],
    requiresPassword: true,
  },
  "comercialara@casatimoni.com.br": {
    name: "Carolina - Vendas Araras",
    email: "comercialara@casatimoni.com.br",
    modules: ["painel", "estoque", "marketing", "reunioes"],
    requiresPassword: false,
  },
  "marketplacerc.mcr@gmail.com": {
    name: "Jaqueline - Marketplace Rio Claro",
    email: "marketplacerc.mcr@gmail.com",
    modules: ["painel", "estoque", "marketing", "reunioes", "motorista"],
    requiresPassword: false,
  },
  "estoquetimoni@gmail.com": {
    name: "Lucas - Estoque Rio Claro",
    email: "estoquetimoni@gmail.com",
    modules: ["painel", "estoque"],
    requiresPassword: false,
  },
  "fotoscasatimoni@gmail.com": {
    name: "Lucas e Vendedores - Araras",
    email: "fotoscasatimoni@gmail.com",
    modules: ["painel", "estoque"],
    requiresPassword: false,
  },
  "balcaotimoni@gmail.com": {
    name: "Vendedores - Rio Claro",
    email: "balcaotimoni@gmail.com",
    modules: ["painel", "estoque"],
    requiresPassword: false,
  },
  "caixatimonirioclaro@gmail.com": {
    name: "Thais - Rio Claro",
    email: "caixatimonirioclaro@gmail.com",
    modules: ["painel", "motorista"],
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
