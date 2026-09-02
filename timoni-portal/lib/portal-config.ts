import {
  entersDirectlyInPainelTimoni,
  normalizeEmail,
  portalUsers,
  type PortalModule,
  type PortalUser,
} from "@/lib/access-control";
import { AVISO_TEAM_MEMBERS, TEAM_MEMBERS, type TeamMember } from "@/lib/team-members";
import { AVISO_LEITURAS_SPREADSHEET_ID } from "@/lib/portal-data-constants";

const USERS_SHEET = "PortalUsuarios";
const COLLABORATORS_SHEET = "PortalColaboradores";
const HISTORY_SHEET = "PortalHistorico";
const REQUIRED_SHEETS = [USERS_SHEET, COLLABORATORS_SHEET, HISTORY_SHEET];
export const CICA_EMAIL = "mcrodini@gmail.com";
export const DASHBOARD_BOX_MODULES: PortalModule[] = ["painel", "agenda", "compras", "conferencia", "estoque", "motorista", "reunioes", "leads"];

export type ConfiguredCollaborator = TeamMember & {
  id: string;
  active: boolean;
  noticeRequired: boolean;
  updatedAt: string;
};

export type PortalAuditEntry = {
  date: string;
  action: string;
  details: string;
  actor: string;
};

export type PortalConfiguration = {
  users: PortalUser[];
  collaborators: ConfiguredCollaborator[];
  history: PortalAuditEntry[];
};

function sheetsUrl(path = "", query?: Record<string, string>) {
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${AVISO_LEITURAS_SPREADSHEET_ID}${path}`);
  for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, value);
  return url.toString();
}

async function sheetsRequest<T>(accessToken: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Sheets respondeu ${response.status}: ${body.slice(0, 300)}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function yes(value: string | undefined, fallback = false) {
  if (!value) return fallback;
  return ["sim", "true", "1", "ativo"].includes(value.trim().toLowerCase());
}

function csvModules(value: string | undefined): PortalModule[] {
  return (value || "").split(",").map((item) => item.trim()).filter(Boolean) as PortalModule[];
}

function defaultUnit(email: string): PortalUser["unit"] {
  const normalized = normalizeEmail(email);
  if ([CICA_EMAIL, "mrodini@gmail.com"].includes(normalized)) return "Geral";
  if ([
    "estoqueararascasatimoni@gmail.com",
    "comercialara@casatimoni.com.br",
    "fotoscasatimoni@gmail.com",
    "reginaldo@casatimoni.com.br",
    "casatimoniararas@gmail.com",
  ].includes(normalized)) return "Araras";
  return "Rio Claro";
}

export function defaultPortalUsers(): PortalUser[] {
  return Object.values(portalUsers).map((user) => ({
    ...user,
    unit: defaultUnit(user.email),
    active: true,
    directPainel: entersDirectlyInPainelTimoni(user.email),
    boxes: DASHBOARD_BOX_MODULES.filter((module) => user.modules.includes(module)),
    lastAccess: "",
  }));
}

export function defaultCollaborators(): ConfiguredCollaborator[] {
  const noticeKeys = new Set(AVISO_TEAM_MEMBERS.map((member) => `${member.unit}::${member.name}`));
  return TEAM_MEMBERS.map((member) => ({
    ...member,
    id: `${member.unit}-${member.name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    active: true,
    noticeRequired: noticeKeys.has(`${member.unit}::${member.name}`),
    updatedAt: "",
  }));
}

async function ensureSheets(accessToken: string) {
  const spreadsheet = await sheetsRequest<{ sheets?: Array<{ properties?: { title?: string } }> }>(
    accessToken,
    sheetsUrl("", { fields: "sheets.properties.title" }),
  );
  const existing = new Set((spreadsheet.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean));
  const missing = REQUIRED_SHEETS.filter((title) => !existing.has(title));
  if (missing.length) {
    await sheetsRequest(accessToken, sheetsUrl(":batchUpdate"), {
      method: "POST",
      body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }),
    });
  }
}

async function readUsers(accessToken: string): Promise<PortalUser[]> {
  const response = await sheetsRequest<{ values?: string[][] }>(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${USERS_SHEET}!A2:K500`)}`, { valueRenderOption: "FORMATTED_VALUE" }));
  return (response.values || []).map((row) => ({
    email: normalizeEmail(row[0]),
    name: row[1] || "",
    unit: (row[2] || "Rio Claro") as PortalUser["unit"],
    modules: csvModules(row[3]),
    boxes: csvModules(row[4]),
    requiresPassword: yes(row[5]),
    readOnly: yes(row[6]),
    active: yes(row[7], true),
    directPainel: yes(row[8]),
    lastAccess: row[9] || "",
  })).filter((user) => user.email && user.name);
}

async function readCollaborators(accessToken: string): Promise<ConfiguredCollaborator[]> {
  const response = await sheetsRequest<{ values?: string[][] }>(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${COLLABORATORS_SHEET}!A2:F500`)}`, { valueRenderOption: "FORMATTED_VALUE" }));
  return (response.values || []).map((row) => ({
    id: row[0] || "",
    name: row[1] || "",
    unit: (row[2] || "Rio Claro") as TeamMember["unit"],
    active: yes(row[3], true),
    noticeRequired: yes(row[4], true),
    updatedAt: row[5] || "",
  })).filter((member) => member.id && member.name);
}

async function readHistory(accessToken: string): Promise<PortalAuditEntry[]> {
  const response = await sheetsRequest<{ values?: string[][] }>(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${HISTORY_SHEET}!A2:D500`)}`, { valueRenderOption: "FORMATTED_VALUE" }));
  return (response.values || []).map((row) => ({
    date: row[0] || "",
    action: row[1] || "",
    details: row[2] || "",
    actor: row[3] || "",
  })).filter((item) => item.date && item.action).reverse().slice(0, 100);
}

async function replaceRange(accessToken: string, range: string, values: string[][]) {
  await sheetsRequest(accessToken, sheetsUrl(`/values/${encodeURIComponent(range)}:clear`), { method: "POST", body: "{}" });
  if (values.length) {
    const startRange = range.replace(/A2:.+$/, "A2");
    await sheetsRequest(accessToken, sheetsUrl(`/values/${encodeURIComponent(startRange)}`, { valueInputOption: "RAW" }), {
      method: "PUT",
      body: JSON.stringify({ values }),
    });
  }
}

export async function writeUsers(accessToken: string, users: PortalUser[]) {
  const now = new Date().toISOString();
  const normalized = users.map((user) => ({
    ...user,
    email: normalizeEmail(user.email),
    active: normalizeEmail(user.email) === CICA_EMAIL ? true : user.active !== false,
  }));
  const cicaDefault = defaultPortalUsers().find((user) => user.email === CICA_EMAIL)!;
  const cicaIndex = normalized.findIndex((user) => user.email === CICA_EMAIL);
  if (cicaIndex < 0) normalized.push({ ...cicaDefault, active: true });
  else normalized[cicaIndex] = {
    ...normalized[cicaIndex],
    email: CICA_EMAIL,
    name: "Ciça Rodini",
    modules: cicaDefault.modules,
    active: true,
    readOnly: false,
    directPainel: false,
  };
  await replaceRange(accessToken, `${USERS_SHEET}!A2:K500`, normalized.map((user) => [
    user.email,
    user.name,
    user.unit || defaultUnit(user.email) || "Rio Claro",
    user.modules.join(","),
    (user.boxes || []).join(","),
    user.requiresPassword ? "Sim" : "Não",
    user.readOnly ? "Sim" : "Não",
    user.active === false ? "Não" : "Sim",
    user.directPainel ? "Sim" : "Não",
    user.lastAccess || "",
    now,
  ]));
}

export async function writeCollaborators(accessToken: string, collaborators: ConfiguredCollaborator[]) {
  const now = new Date().toISOString();
  await replaceRange(accessToken, `${COLLABORATORS_SHEET}!A2:F500`, collaborators.map((member) => [
    member.id,
    member.name,
    member.unit,
    member.active ? "Sim" : "Não",
    member.noticeRequired ? "Sim" : "Não",
    member.updatedAt || now,
  ]));
}

export async function appendAudit(accessToken: string, action: string, details: string, actor = CICA_EMAIL) {
  await sheetsRequest(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${HISTORY_SHEET}!A:D`)}:append`, {
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
  }), {
    method: "POST",
    body: JSON.stringify({ values: [[new Date().toISOString(), action, details, actor]] }),
  });
}

export async function ensurePortalConfiguration(accessToken: string) {
  await ensureSheets(accessToken);
  const [users, collaborators] = await Promise.all([readUsers(accessToken), readCollaborators(accessToken)]);
  if (!users.length) await writeUsers(accessToken, defaultPortalUsers());
  if (!collaborators.length) await writeCollaborators(accessToken, defaultCollaborators());
}

export async function loadPortalConfiguration(accessToken: string): Promise<PortalConfiguration> {
  await ensurePortalConfiguration(accessToken);
  const [users, collaborators, history] = await Promise.all([
    readUsers(accessToken),
    readCollaborators(accessToken),
    readHistory(accessToken),
  ]);
  return { users, collaborators, history };
}

export async function getEffectivePortalUser(accessToken: string | undefined, email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  if (!accessToken) return portalUsers[normalized] || null;
  try {
    await ensureSheets(accessToken);
    const users = await readUsers(accessToken);
    if (!users.length) return portalUsers[normalized] || null;
    return users.find((user) => user.email === normalized && user.active !== false) || null;
  } catch (error) {
    console.warn("[portal-config] Não foi possível carregar a configuração dinâmica; usando base segura.", error);
    return portalUsers[normalized] || null;
  }
}

export async function getEffectiveCollaborators(accessToken?: string) {
  if (!accessToken) return defaultCollaborators();
  try {
    await ensurePortalConfiguration(accessToken);
    return (await readCollaborators(accessToken)).filter((member) => member.active);
  } catch (error) {
    console.warn("[portal-config] Não foi possível carregar colaboradores; usando base segura.", error);
    return defaultCollaborators().filter((member) => member.active);
  }
}

export async function recordPortalAccess(accessToken: string, email: string) {
  try {
    await ensurePortalConfiguration(accessToken);
    const users = await readUsers(accessToken);
    const index = users.findIndex((user) => user.email === normalizeEmail(email));
    if (index < 0) return;
    const range = `${USERS_SHEET}!J${index + 2}`;
    await sheetsRequest(accessToken, sheetsUrl(`/values/${encodeURIComponent(range)}`, { valueInputOption: "RAW" }), {
      method: "PUT",
      body: JSON.stringify({ values: [[new Date().toISOString()]] }),
    });
  } catch (error) {
    console.warn("[portal-config] Não foi possível registrar o último acesso.", error);
  }
}
