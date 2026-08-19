export type PortalModule =
  | "painel"
  | "agenda"
  | "compras"
  | "conferencia"
  | "estoque"
  | "motorista"
  | "reunioes"
  | "leads"
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
  "motorista",
  "reunioes",
  "leads",
];

const modulesWithoutCicaAgenda = allModules.filter((module) => module !== "agenda");
const operationalModules: PortalModule[] = ["painel", "estoque", "motorista"];
const CICA_EMAIL = "mcrodini@gmail.com";
const MANAGEMENT_MOTORISTA_EMAILS = new Set([
  "mrodini@gmail.com",
  "margareth@casatimoni.com.br",
]);
const COLLABORATOR_MOTORISTA_CONTROL_EMAILS = new Set([
  "estoquetimoni@gmail.com",
  "marketplacerc.mcr@gmail.com",
  "comercialara@casatimoni.com.br",
  "carolina@casatimoni.com.br",
  "comercialrc@casatimoni.com.br",
  "reginaldo@casatimoni.com.br",
]);

function operationalUser(name: string, email: string): PortalUser {
  return { name, email, modules: operationalModules, requiresPassword: false, readOnly: !COLLABORATOR_MOTORISTA_CONTROL_EMAILS.has(email) };
}

export const portalUsers: Record<string, PortalUser> = {
  "mcrodini@gmail.com": { name: "Ciça Rodini", email: "mcrodini@gmail.com", modules: allModules, requiresPassword: true },
  "mrodini@gmail.com": { name: "Marcelo Rodini", email: "mrodini@gmail.com", modules: modulesWithoutCicaAgenda, requiresPassword: true },
  "margareth@casatimoni.com.br": { name: "Margareth", email: "margareth@casatimoni.com.br", modules: allModules, requiresPassword: true },
  "fotoscasatimoni@gmail.com": operationalUser("Lucas e Vendedores - Araras", "fotoscasatimoni@gmail.com"),
  "balcaotimoni@gmail.com": operationalUser("Vendedores - Rio Claro", "balcaotimoni@gmail.com"),
  "caixatimonirioclaro@gmail.com": operationalUser("Thais - Rio Claro", "caixatimonirioclaro@gmail.com"),
  "estoquetimoni@gmail.com": operationalUser("Lucas - Estoque Rio Claro", "estoquetimoni@gmail.com"),
  "marketplacerc.mcr@gmail.com": operationalUser("Jaqueline - Marketplace Rio Claro", "marketplacerc.mcr@gmail.com"),
  "comercialara@casatimoni.com.br": operationalUser("Carolina - Vendas Araras", "comercialara@casatimoni.com.br"),
  "carolina@casatimoni.com.br": operationalUser("Carolina - Rio Claro", "carolina@casatimoni.com.br"),
  "comercialrc@casatimoni.com.br": operationalUser("Jeovana - Rio Claro", "comercialrc@casatimoni.com.br"),
  "reginaldo@casatimoni.com.br": operationalUser("Reginaldo - Araras", "reginaldo@casatimoni.com.br"),
  "estoqueararascasatimoni@gmail.com": { name: "Estoque Araras", email: "estoqueararascasatimoni@gmail.com", modules: operationalModules, requiresPassword: true },
  "casatimoniararas@gmail.com": { name: "Casa Timoni Araras", email: "casatimoniararas@gmail.com", modules: operationalModules, requiresPassword: false },
};

export function normalizeEmail(email?: string | null) { return email?.trim().toLowerCase() ?? ""; }
export function isAuthorizedUser(email?: string | null) { return Boolean(portalUsers[normalizeEmail(email)]); }
export function getPortalUser(email?: string | null) { return portalUsers[normalizeEmail(email)] ?? null; }
export function hasModuleAccess(email: string | null | undefined, module: PortalModule) { return getPortalUser(email)?.modules.includes(module) ?? false; }
export function isCicaAccess(email?: string | null) { return normalizeEmail(email) === CICA_EMAIL; }
export function canManageMotorista(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (normalized === CICA_EMAIL) return true;
  if (MANAGEMENT_MOTORISTA_EMAILS.has(normalized)) return true;
  return COLLABORATOR_MOTORISTA_CONTROL_EMAILS.has(normalized);
}
export function isReadOnlyUser(email?: string | null) { return !canManageMotorista(email); }
