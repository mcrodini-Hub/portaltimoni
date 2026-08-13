import { cookies } from "next/headers";

export const TRELLO_BOARD_SHORT_LINK = "UfPrTr1H";
export const TRELLO_BOARD_URL = "https://trello.com/b/UfPrTr1H/compras";
export const TRELLO_API_KEY = "6d6dfd3e5a2a67b5a99006ae2825a5df";

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

export async function getStoredTrelloCredentials(): Promise<TrelloCredentials | null> {
  const cookieStore = await cookies();
  const key = cookieStore.get("timoni_trello_key")?.value?.trim();
  const token = cookieStore.get("timoni_trello_token")?.value?.trim();
  if (key && token) return { key, token };
  return getServerTrelloCredentials();
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
            throw new Error("Trello ainda não configurado neste navegador.");
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
