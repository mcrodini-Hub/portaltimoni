import { auth } from "@/lib/auth";
import { google } from "googleapis";
import { cookies } from "next/headers";

export const TRELLO_BOARD_SHORT_LINK = "UfPrTr1H";
export const TRELLO_BOARD_URL = "https://trello.com/b/UfPrTr1H/compras";
export const TRELLO_API_KEY = "6d6dfd3e5a2a67b5a99006ae2825a5df";

const TRELLO_APPDATA_FILE = "portal-timoni-trello-config";

export type TrelloCredentials = {
  key: string;
  token: string;
};

function getServerTrelloCredentials(): TrelloCredentials | null {
  const key = (process.env.TRELLO_API_KEY || TRELLO_API_KEY).trim();
  const token = (
    process.env.TRELLO_TOKEN ||
    process.env.TRELLO_API_TOKEN ||
    process.env.TRELLO_ACCESS_TOKEN ||
    ""
  ).trim();
  return key && token ? { key, token } : null;
}

async function driveClient(accessToken?: string) {
  const token = accessToken || (await auth())?.accessToken;
  if (!token) return null;
  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: token });
  return google.drive({ version: "v3", auth: oauth });
}

async function findAppDataFile(accessToken?: string) {
  const drive = await driveClient(accessToken);
  if (!drive) return { drive: null, file: null };
  const response = await drive.files.list({
    spaces: "appDataFolder",
    q: `name='${TRELLO_APPDATA_FILE}' and trashed=false`,
    pageSize: 1,
    fields: "files(id,appProperties)",
  });
  return { drive, file: response.data.files?.[0] || null };
}

async function getDriveTrelloCredentials(): Promise<TrelloCredentials | null> {
  try {
    const { file } = await findAppDataFile();
    const key = file?.appProperties?.trelloKey?.trim();
    const token = file?.appProperties?.trelloToken?.trim();
    return key && token ? { key, token } : null;
  } catch {
    return null;
  }
}

async function saveDriveTrelloCredentials(
  credentials: TrelloCredentials,
  accessToken?: string,
): Promise<boolean> {
  try {
    const { drive, file } = await findAppDataFile(accessToken);
    if (!drive) return false;
    const requestBody = {
      name: TRELLO_APPDATA_FILE,
      appProperties: {
        trelloKey: credentials.key,
        trelloToken: credentials.token,
      },
    };
    if (file?.id) {
      await drive.files.update({ fileId: file.id, requestBody });
    } else {
      await drive.files.create({
        requestBody: {
          ...requestBody,
          parents: ["appDataFolder"],
        },
        fields: "id",
      });
    }
    return true;
  } catch {
    return false;
  }
}

async function deleteDriveTrelloCredentials(accessToken?: string) {
  try {
    const { drive, file } = await findAppDataFile(accessToken);
    if (drive && file?.id) await drive.files.delete({ fileId: file.id });
  } catch {
    // A remoção do cookie continua sendo suficiente para encerrar a sessão local.
  }
}

export async function getStoredTrelloCredentials(): Promise<TrelloCredentials | null> {
  const cookieStore = await cookies();
  const key = cookieStore.get("timoni_trello_key")?.value?.trim();
  const token = cookieStore.get("timoni_trello_token")?.value?.trim();
  if (key && token) {
    // Migração automática para armazenamento privado no Drive quando o novo escopo já estiver autorizado.
    await saveDriveTrelloCredentials({ key, token });
    return { key, token };
  }

  const serverCredentials = getServerTrelloCredentials();
  if (serverCredentials) return serverCredentials;

  return getDriveTrelloCredentials();
}

export async function persistTrelloCredentials(
  credentials: TrelloCredentials,
  accessToken?: string,
) {
  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
  cookieStore.set("timoni_trello_key", credentials.key, cookieOptions);
  cookieStore.set("timoni_trello_token", credentials.token, cookieOptions);
  const cloudSaved = await saveDriveTrelloCredentials(credentials, accessToken);
  return { cloudSaved };
}

export async function clearStoredTrelloCredentials(accessToken?: string) {
  const cookieStore = await cookies();
  const clearOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
  cookieStore.set("timoni_trello_key", "", clearOptions);
  cookieStore.set("timoni_trello_token", "", clearOptions);
  await deleteDriveTrelloCredentials(accessToken);
}

function buildUrl(
  path: string,
  credentials: TrelloCredentials,
  params?: Record<string, string | number | boolean | undefined>,
) {
  const url = new URL(`https://api.trello.com/1${path}`);
  url.searchParams.set("key", credentials.key);
  url.searchParams.set("token", credentials.token);
  Object.entries(params || {}).forEach(([name, value]) => {
    if (value !== undefined) url.searchParams.set(name, String(value));
  });
  return url;
}

function buildPublicReadUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  const url = new URL(`https://api.trello.com/1${path}`);
  url.searchParams.set("key", (process.env.TRELLO_API_KEY || TRELLO_API_KEY).trim());
  Object.entries(params || {}).forEach(([name, value]) => {
    if (value !== undefined) url.searchParams.set(name, String(value));
  });
  return url;
}

function isStockSharedRead(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" | undefined,
  params?: Record<string, string | number | boolean | undefined>,
) {
  if (method && method !== "GET") return false;
  if (
    path === `/boards/${TRELLO_BOARD_SHORT_LINK}` &&
    params?.fields === "name" &&
    params?.lists === "open" &&
    params?.list_fields === "name,closed" &&
    params?.labels === undefined
  ) {
    return true;
  }
  return /^\/lists\/[^/]+\/cards$/.test(path) && params?.fields === "name,start,due,dateLastActivity,closed";
}

export async function trelloFetch<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    params?: Record<string, string | number | boolean | undefined>;
    body?: BodyInit | null;
    credentials?: TrelloCredentials;
  } = {},
): Promise<T> {
  const credentials = options.credentials || (await getStoredTrelloCredentials());
  const sharedStockRead = isStockSharedRead(path, options.method, options.params);

  const response = await fetch(
    credentials
      ? buildUrl(path, credentials, options.params)
      : sharedStockRead
        ? buildPublicReadUrl(path, options.params)
        : (() => {
            throw new Error("Trello ainda não configurado no Portal.");
          })(),
    {
      method: options.method || "GET",
      body: options.body,
      cache: "no-store",
    },
  );

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : (payload as { message?: string; error?: string } | null)?.message ||
          (payload as { message?: string; error?: string } | null)?.error ||
          `Trello respondeu HTTP ${response.status}.`;
    throw new Error(message);
  }

  return payload as T;
}

export async function validateTrelloCredentials(credentials: TrelloCredentials) {
  return trelloFetch<{ id: string; name: string }>(`/boards/${TRELLO_BOARD_SHORT_LINK}`, {
    credentials,
    params: { fields: "name" },
  });
}

export function normalizeTrelloText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
