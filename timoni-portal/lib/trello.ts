import { cookies } from "next/headers";

export const TRELLO_BOARD_SHORT_LINK = "UfPrTr1H";
export const TRELLO_BOARD_URL = "https://trello.com/b/UfPrTr1H/compras";
export const TRELLO_API_KEY = "6d6dfd3e5a2a67b5a99006ae2825a5df";

export type TrelloCredentials = {
  key: string;
  token: string;
};

export async function getStoredTrelloCredentials(): Promise<TrelloCredentials | null> {
  const cookieStore = await cookies();
  const key = cookieStore.get("timoni_trello_key")?.value?.trim();
  const token = cookieStore.get("timoni_trello_token")?.value?.trim();
  return key && token ? { key, token } : null;
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

function isOptionalStockSentOrdersRead(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  return (
    path === `/boards/${TRELLO_BOARD_SHORT_LINK}` &&
    params?.fields === "name" &&
    params?.lists === "open" &&
    params?.list_fields === "name,closed" &&
    params?.labels === undefined
  );
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
  if (!credentials) {
    if (isOptionalStockSentOrdersRead(path, options.params)) {
      return { lists: [] } as T;
    }
    throw new Error("Trello ainda não configurado neste navegador.");
  }

  const response = await fetch(buildUrl(path, credentials, options.params), {
    method: options.method || "GET",
    body: options.body,
    cache: "no-store",
  });

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
