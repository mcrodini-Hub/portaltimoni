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
const ROTATING_STOCK_MIGRATION = "Permissões Estoque Rotativo v1";
const CHAT_ALL_ACCESS_MIGRATION = "Chat disponível em todos os acessos v1";
const REQUIRED_SHEETS = [USERS_SHEET, COLLABORATORS_SHEET, HISTORY_SHEET];
export const CICA_EMAIL = "mcrodini@gmail.com";
export const DASHBOARD_BOX_MODULES: PortalModule[] = ["painel", "agenda", "compras", "conferencia", "estoque", "estoque-rotativo", "motorista", "reunioes", "leads"];

export type ConfiguredCollaborator = TeamMember & {
  id: string;
  accessEmail: string;
  active: boolean;
  noticeRequired: boolean;
  chatEnabled: boolean;
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
  let response: Response | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
    if (response.status !== 429) break;
    const retryAfter = Number(response.headers.get("retry-after") || "0");
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  if (!response || !response.ok) {
    const body = response ? await response.text() : "";
    throw new Error(`Google Sheets respondeu ${response?.status || 500}: ${body.slice(0, 300)}`);
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

const EXISTING_ACCESS_LABELS: Record<string, string> = {
  "mcrodini@gmail.com": "Ciça",
  "mrodini@gmail.com": "Marcelo",
  "balcaotimoni@gmail.com": "Vendedores Rio Claro",
  "fotoscasatimoni@gmail.com": "Vendedores Araras",
  "caixarctimoni@gmail.com": "Caixa Rio Claro",
  "estoquetimoni@gmail.com": "Estoque Rio Claro",
  "estoqueararascasatimoni@gmail.com": "Estoque Araras",
  "marketplacerc.mcr@gmail.com": "Marketplace Rio Claro",
  "comercialrc@casatimoni.com.br": "Comercial Rio Claro",
  "comercialara@casatimoni.com.br": "Comercial Araras",
  "casatimoniararas@gmail.com": "Casa Timoni Araras",
  "carolina@casatimoni.com.br": "Vendas Rio Claro",
  "reginaldo@casatimoni.com.br": "Vendas Araras",
  "margareth@casatimoni.com.br": "Gestão",
};

function defaultAccessLabel(email: string) {
  return EXISTING_ACCESS_LABELS[normalizeEmail(email)] || `Acesso ${defaultUnit(email)}`;
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
    accessLabel: defaultAccessLabel(user.email),
    active: user.active !== false,
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
    accessEmail: "",
    active: true,
    noticeRequired: noticeKeys.has(`${member.unit}::${member.name}`),
    chatEnabled: true,
    updatedAt: "",
  }));
}

let ensureSheetsPromise: Promise<void> | null = null;

async function ensureSheets(accessToken: string) {
  if (ensureSheetsPromise) return ensureSheetsPromise;
  ensureSheetsPromise = (async () => {
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
  })().catch((error) => {
    ensureSheetsPromise = null;
    throw error;
  });
  return ensureSheetsPromise;
}

async function readUsers(accessToken: string): Promise<PortalUser[]> {
  const response = await sheetsRequest<{ values?: string[][] }>(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${USERS_SHEET}!A2:M500`)}`, { valueRenderOption: "FORMATTED_VALUE" }));
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
    mobileModules: row[11] ? row[11] === "nenhum" ? [] : csvModules(row[11]) : undefined,
    accessLabel: row[12] || "",
  })).filter((user) => user.email && user.name);
}

export async function listConfiguredPortalUsers(accessToken: string) {
  return readUsers(accessToken);
}

async function readCollaborators(accessToken: string): Promise<ConfiguredCollaborator[]> {
  const response = await sheetsRequest<{ values?: string[][] }>(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${COLLABORATORS_SHEET}!A2:H500`)}`, { valueRenderOption: "FORMATTED_VALUE" }));
  return (response.values || []).map((row) => ({
    id: row[0] || "",
    name: row[1] || "",
    unit: (row[2] || "Rio Claro") as TeamMember["unit"],
    active: yes(row[3], true),
    noticeRequired: yes(row[4], true),
    updatedAt: row[5] || "",
    accessEmail: normalizeEmail(row[6] || ""),
    chatEnabled: yes(row[7], true),
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
    active: true,
    readOnly: false,
  };
  await replaceRange(accessToken, `${USERS_SHEET}!A2:M500`, normalized.map((user) => [
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
    user.mobileModules === undefined ? "" : user.mobileModules.join(",") || "nenhum",
    user.accessLabel || user.name,
  ]));
}

function userRow(user: PortalUser, now = new Date().toISOString()) {
  return [
    normalizeEmail(user.email),
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
    user.mobileModules === undefined ? "" : user.mobileModules.join(",") || "nenhum",
    user.accessLabel || user.name,
  ];
}

export async function upsertPortalUser(accessToken: string, input: PortalUser) {
  await ensureSheets(accessToken);
  const user = {
    ...input,
    email: normalizeEmail(input.email),
    active: normalizeEmail(input.email) === CICA_EMAIL ? true : input.active !== false,
  };
  const response = await sheetsRequest<{ values?: string[][] }>(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${USERS_SHEET}!A2:A500`)}`, { valueRenderOption: "FORMATTED_VALUE" }));
  const index = (response.values || []).findIndex((row) => normalizeEmail(row[0]) === user.email);
  if (index >= 0) {
    await sheetsRequest(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${USERS_SHEET}!A${index + 2}:M${index + 2}`)}`, { valueInputOption: "RAW" }), {
      method: "PUT",
      body: JSON.stringify({ values: [userRow(user)] }),
    });
  } else {
    await sheetsRequest(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${USERS_SHEET}!A:M`)}:append`, { valueInputOption: "RAW", insertDataOption: "INSERT_ROWS" }), {
      method: "POST",
      body: JSON.stringify({ values: [userRow(user)] }),
    });
  }
  return user;
}

export async function writeCollaborators(accessToken: string, collaborators: ConfiguredCollaborator[]) {
  const now = new Date().toISOString();
  await replaceRange(accessToken, `${COLLABORATORS_SHEET}!A2:H500`, collaborators.map((member) => [
    member.id,
    member.name,
    member.unit,
    member.active ? "Sim" : "Não",
    member.noticeRequired ? "Sim" : "Não",
    member.updatedAt || now,
    normalizeEmail(member.accessEmail || ""),
    member.chatEnabled === false ? "Não" : "Sim",
  ]));
}

export async function upsertCollaborator(accessToken: string, member: ConfiguredCollaborator) {
  await ensureSheets(accessToken);
  const response = await sheetsRequest<{ values?: string[][] }>(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${COLLABORATORS_SHEET}!A2:A500`)}`, { valueRenderOption: "FORMATTED_VALUE" }));
  const index = (response.values || []).findIndex((row) => row[0] === member.id);
  const values = [[member.id, member.name, member.unit, member.active ? "Sim" : "Não", member.noticeRequired ? "Sim" : "Não", member.updatedAt || new Date().toISOString(), normalizeEmail(member.accessEmail || ""), member.chatEnabled === false ? "Não" : "Sim"]];
  if (index >= 0) {
    await sheetsRequest(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${COLLABORATORS_SHEET}!A${index + 2}:H${index + 2}`)}`, { valueInputOption: "RAW" }), { method: "PUT", body: JSON.stringify({ values }) });
  } else {
    await sheetsRequest(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${COLLABORATORS_SHEET}!A:H`)}:append`, { valueInputOption: "RAW", insertDataOption: "INSERT_ROWS" }), { method: "POST", body: JSON.stringify({ values }) });
  }
  return member;
}

export async function deleteCollaborator(accessToken: string, id: string) {
  const response = await sheetsRequest<{ values?: string[][] }>(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${COLLABORATORS_SHEET}!A2:A500`)}`));
  const index = (response.values || []).findIndex((row) => row[0] === id);
  if (index < 0) return false;
  const row = index + 2;
  await sheetsRequest(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${COLLABORATORS_SHEET}!A${row}:H${row}`)}:clear`), { method: "POST", body: "{}" });
  return true;
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
  let [users, collaborators] = await Promise.all([readUsers(accessToken), readCollaborators(accessToken)]);
  if (!users.length) {
    users = defaultPortalUsers();
    await writeUsers(accessToken, users);
  }
  if (!collaborators.length) {
    collaborators = defaultCollaborators();
    await writeCollaborators(accessToken, collaborators);
  }

  // Importação única dos rótulos antigos. Depois disso, PortalUsuarios!M
  // é a fonte para Configurações e para os destinatários dos Avisos.
  const cicaUser = users.find((user) => user.email === CICA_EMAIL);
  if (cicaUser && !cicaUser.modules.includes("agenda-ct")) {
    const updatedCica = {
      ...cicaUser,
      modules: [...cicaUser.modules, "agenda-ct" as PortalModule],
      mobileModules: cicaUser.mobileModules === undefined
        ? undefined
        : [...new Set([...cicaUser.mobileModules, "agenda-ct" as PortalModule])],
    };
    await upsertPortalUser(accessToken, updatedCica);
    users = users.map((user) => user.email === CICA_EMAIL ? updatedCica : user);
    await appendAudit(accessToken, "Agenda CT liberada", "Agenda CT habilitada para o acesso da Ciça.", CICA_EMAIL);
  }

  if (users.some((user) => !user.accessLabel)) {
    const response = await sheetsRequest<{ values?: string[][] }>(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${USERS_SHEET}!A2:M500`)}`, { valueRenderOption: "FORMATTED_VALUE" }));
    const data = (response.values || []).flatMap((row, index) => {
      const email = normalizeEmail(row[0]);
      if (!email || row[12]) return [];
      return [{ range: `${USERS_SHEET}!M${index + 2}`, values: [[defaultAccessLabel(email)]] }];
    });
    if (data.length) {
      await sheetsRequest(accessToken, sheetsUrl("/values:batchUpdate"), {
        method: "POST",
        body: JSON.stringify({ valueInputOption: "RAW", data }),
      });
      users = await readUsers(accessToken);
    }
  }

  // O vínculo com um acesso é apenas pelo e-mail. Nome, unidade e status do
  // colaborador são dados próprios e nunca devem ser sobrescritos pelo acesso.
  const defaultsById = new Map(defaultCollaborators().map((member) => [member.id, member]));
  let collaboratorsChanged = false;

  collaborators = collaborators.map((member) => {
    const original = defaultsById.get(member.id);
    if (!original) return member;

    // A substituição de Thais por Bruna foi uma troca real de colaboradora.
    if (member.id === "rio-claro-thais" && member.name.trim().toLowerCase() === "bruna") {
      return member;
    }

    if (member.name !== original.name || member.unit !== original.unit) {
      collaboratorsChanged = true;
      return {
        ...member,
        name: original.name,
        unit: original.unit,
        updatedAt: new Date().toISOString(),
      };
    }
    return member;
  });

  const defaultIds = new Set(defaultsById.keys());
  const emailDerivedDuplicates = new Set(
    collaborators
      .filter((member) => defaultIds.has(member.id) && member.accessEmail)
      .map((member) => member.accessEmail.replace(/[^a-z0-9]+/g, "-")),
  );
  const dedupedCollaborators = collaborators.filter((member) => {
    if (defaultIds.has(member.id)) return true;
    if (!member.accessEmail) return true;
    const generatedId = member.accessEmail.replace(/[^a-z0-9]+/g, "-");
    const remove = member.id === generatedId && emailDerivedDuplicates.has(generatedId);
    if (remove) collaboratorsChanged = true;
    return !remove;
  });

  if (collaboratorsChanged) {
    collaborators = dedupedCollaborators;
    await writeCollaborators(accessToken, collaborators);
  }

  return { users, collaborators };
}

let chatAllAccessMigration: Promise<void> | null = null;

async function ensureChatAllAccess(accessToken: string) {
  if (!chatAllAccessMigration) chatAllAccessMigration = (async () => {
    const { users } = await ensurePortalConfiguration(accessToken);
    const migrationRows = await sheetsRequest<{ values?: string[][] }>(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${HISTORY_SHEET}!B2:B2000`)}`, { valueRenderOption: "FORMATTED_VALUE" }));
    if ((migrationRows.values || []).some((row) => row[0] === CHAT_ALL_ACCESS_MIGRATION)) return;
    for (const user of users.filter((item) => item.active !== false && !item.modules.includes("chat"))) {
      await upsertPortalUser(accessToken, {
        ...user,
        modules: [...user.modules, "chat"],
        mobileModules: user.mobileModules === undefined ? undefined : [...new Set([...user.mobileModules, "chat" as PortalModule])],
      });
    }
    await appendAudit(accessToken, CHAT_ALL_ACCESS_MIGRATION, "Chat disponibilizado para todos os acessos ativos; liberação individual controlada por colaborador.", CICA_EMAIL);
  })().catch((error) => {
    chatAllAccessMigration = null;
    throw error;
  });
  await chatAllAccessMigration;
}

let rotatingStockMigration: Promise<void> | null = null;

async function ensureRotatingStockPermissions(accessToken: string) {
  if (!rotatingStockMigration) rotatingStockMigration = (async () => {
    const { users } = await ensurePortalConfiguration(accessToken);
    const migrationRows = await sheetsRequest<{ values?: string[][] }>(accessToken, sheetsUrl(`/values/${encodeURIComponent(`${HISTORY_SHEET}!B2:B2000`)}`, { valueRenderOption: "FORMATTED_VALUE" }));
    if ((migrationRows.values || []).some((row) => row[0] === ROTATING_STOCK_MIGRATION)) return;
    const allowed = new Set([CICA_EMAIL, "mrodini@gmail.com", "estoquetimoni@gmail.com", "carolina@casatimoni.com.br"]);
    const changed = users.filter((user) => allowed.has(user.email) && !user.modules.includes("estoque-rotativo"));
    for (const user of changed) {
      await upsertPortalUser(accessToken, {
        ...user,
        modules: [...user.modules, "estoque-rotativo"],
        boxes: [...new Set([...(user.boxes || []), "estoque-rotativo" as const])],
      });
    }
    await appendAudit(accessToken, ROTATING_STOCK_MIGRATION, "Acesso inicial liberado para Ciça, Marcelo, Lucas e Carolina.", CICA_EMAIL);
  })().catch((error) => {
    rotatingStockMigration = null;
    throw error;
  });
  await rotatingStockMigration;
}

export async function loadPortalConfiguration(accessToken: string): Promise<PortalConfiguration> {
  const { users, collaborators } = await ensurePortalConfiguration(accessToken);
  const history = await readHistory(accessToken);
  return { users, collaborators, history };
}

export async function getEffectivePortalUser(accessToken: string | undefined, email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  if (!accessToken) return portalUsers[normalized] || null;
  try {
    await ensureRotatingStockPermissions(accessToken);
    await ensureChatAllAccess(accessToken);
    const users = await readUsers(accessToken);
    if (!users.length) return portalUsers[normalized] || null;
    return users.find((user) => user.email === normalized) || null;
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
