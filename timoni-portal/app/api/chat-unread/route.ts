import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";

export const dynamic = "force-dynamic";

const CHAT_API = "https://chat.googleapis.com/v1";

type ChatSpace = {
  name?: string;
  lastActiveTime?: string;
};

type SpacesResponse = {
  spaces?: ChatSpace[];
  nextPageToken?: string;
};

type ReadStateResponse = {
  lastReadTime?: string;
};

type MessagesResponse = {
  messages?: Array<{ name?: string; createTime?: string }>;
};

async function googleGet<T>(url: string, accessToken: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

async function listSpaces(accessToken: string) {
  const spaces: ChatSpace[] = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({ pageSize: "1000" });
    if (pageToken) params.set("pageToken", pageToken);
    const result = await googleGet<SpacesResponse>(`${CHAT_API}/spaces?${params.toString()}`, accessToken);
    if (!result.ok || !result.data) return { ok: false as const, status: result.status, spaces: [] as ChatSpace[] };
    spaces.push(...(result.data.spaces || []));
    pageToken = result.data.nextPageToken || "";
  } while (pageToken);

  return { ok: true as const, status: 200, spaces };
}

async function hasUnreadMessages(space: ChatSpace, accessToken: string) {
  if (!space.name) return false;
  const spaceId = space.name.replace(/^spaces\//, "");
  const readState = await googleGet<ReadStateResponse>(
    `${CHAT_API}/users/me/spaces/${encodeURIComponent(spaceId)}/spaceReadState`,
    accessToken,
  );

  if (!readState.ok) {
    if (readState.status === 403 || readState.status === 401) throw new Error(`CHAT_AUTH_${readState.status}`);
    return false;
  }

  const lastReadTime = readState.data?.lastReadTime;
  if (!lastReadTime) return false;

  if (space.lastActiveTime && new Date(space.lastActiveTime).getTime() <= new Date(lastReadTime).getTime()) {
    return false;
  }

  const params = new URLSearchParams({
    pageSize: "1",
    orderBy: "createTime DESC",
    filter: `createTime > "${lastReadTime}"`,
  });
  const messages = await googleGet<MessagesResponse>(
    `${CHAT_API}/${space.name}/messages?${params.toString()}`,
    accessToken,
  );

  if (!messages.ok) {
    if (messages.status === 403 || messages.status === 401) throw new Error(`CHAT_AUTH_${messages.status}`);
    return false;
  }

  return Boolean(messages.data?.messages?.length);
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  const accessToken = session?.accessToken;

  if (!email || !accessToken || !hasModuleAccess(email, "chat", session.portalUser)) {
    return NextResponse.json({ unreadConversations: 0 }, { status: email ? 403 : 401 });
  }

  const listed = await listSpaces(accessToken);
  if (!listed.ok) {
    const needsConsent = listed.status === 401 || listed.status === 403;
    return NextResponse.json(
      { unreadConversations: 0, needsConsent },
      { status: needsConsent ? 403 : 502 },
    );
  }

  try {
    let unreadConversations = 0;
    const batchSize = 8;
    for (let index = 0; index < listed.spaces.length; index += batchSize) {
      const batch = listed.spaces.slice(index, index + batchSize);
      const results = await Promise.all(batch.map((space) => hasUnreadMessages(space, accessToken)));
      unreadConversations += results.filter(Boolean).length;
    }

    return NextResponse.json(
      { unreadConversations },
      { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=20" } },
    );
  } catch (error) {
    const needsConsent = error instanceof Error && error.message.startsWith("CHAT_AUTH_");
    return NextResponse.json(
      { unreadConversations: 0, needsConsent },
      { status: needsConsent ? 403 : 502 },
    );
  }
}
