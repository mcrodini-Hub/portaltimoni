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
  readOnly?: boolean;
};

const allModules: PortalModule[] = [
  "painel",
  "agenda",
  "compras",
  "conferencia",
  "estoque",
  "financeiro",
  "marketing",
  "motorista",
  "reunioes",
];

const modulesWithoutCicaAgenda = allModules.filter((module) => module !== "agenda");
const operationalModules: PortalModule[] = ["painel", "estoque", "motorista"];
const commercialRioClaroModules: PortalModule[] = ["painel", "estoque", "financeiro", "marketing", "motorista"];

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
    modules: modulesWithoutCicaAgenda,
    requiresPassword: true,
  },
  "margareth@casatimoni.com.br": {
    name: "Margareth",
    email: "margareth@casatimoni.com.br",
    modules: allModules.filter((module) => module !== "marketing"),
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
    modules: commercialRioClaroModules,
    requiresPassword: true,
  },
  "estoqueararascasatimoni@gmail.com": {
    name: "Estoque Araras",
    email: "estoqueararascasatimoni@gmail.com",
    modules: operationalModules,
    requiresPassword: true,
  },
  "comercialara@casatimoni.com.br": {
    name: "Carolina - Vendas Araras",
    email: "comercialara@casatimoni.com.br",
    modules: withStock(["painel", "motorista"]),
    requiresPassword: false,
    readOnly: true,
  },
  "casatimoniararas@gmail.com": {
    name: "Casa Timoni Araras",
    email: "casatimoniararas@gmail.com",
    modules: operationalModules,
    requiresPassword: false,
  },
  "marketplacerc.mcr@gmail.com": {
    name: "Jaqueline - Marketplace Rio Claro",
    email: "marketplacerc.mcr@gmail.com",
    modules: operationalModules,
    requiresPassword: false,
  },
  "estoquetimoni@gmail.com": {
    name: "Lucas - Estoque Rio Claro",
    email: "estoquetimoni@gmail.com",
    modules: operationalModules,
    requiresPassword: false,
    readOnly: true,
  },
  "fotoscasatimoni@gmail.com": {
    name: "Lucas e Vendedores - Araras",
    email: "fotoscasatimoni@gmail.com",
    modules: operationalModules,
    requiresPassword: false,
    readOnly: true,
  },
  "balcaotimoni@gmail.com": {
    name: "Vendedores - Rio Claro",
    email: "balcaotimoni@gmail.com",
    modules: withStock(["painel", "motorista"]),
    requiresPassword: false,
    readOnly: true,
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

export function isReadOnlyUser(email?: string | null) {
  return getPortalUser(email)?.readOnly === true;
}
