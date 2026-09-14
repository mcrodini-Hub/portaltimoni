import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";
import type { PortalUser } from "@/lib/access-control";
import { getEffectivePortalUser, recordPortalAccess } from "@/lib/portal-config";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const PORTAL_CONFIG_REFRESH_MS = 60_000;

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "RefreshAccessTokenError";
    portalUser?: PortalUser | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: "RefreshAccessTokenError";
    portalUser?: PortalUser | null;
    portalConfigAt?: number;
  }
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    if (!token.refreshToken) {
      return { ...token, error: "RefreshAccessTokenError" };
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
      cache: "no-store",
    });

    const refreshed = await response.json();
    if (!response.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in || 3600),
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch (error) {
    console.error("[auth] Falha temporária ao renovar token Google.", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive.appdata",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  callbacks: {
    async signIn({ user, account }) {
      const configured = await getEffectivePortalUser(account?.access_token, user.email);
      return Boolean(configured);
    },
    async jwt({ token, account }) {
      if (account) {
        const configured = await getEffectivePortalUser(account.access_token, token.email);
        if (account.access_token && token.email) await recordPortalAccess(account.access_token, token.email);
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token ?? token.refreshToken,
          expiresAt: account.expires_at,
          error: undefined,
          portalUser: configured,
          portalConfigAt: Date.now(),
        };
      }

      let current = token;
      if (token.expiresAt && Date.now() / 1000 >= token.expiresAt - 120) {
        current = await refreshAccessToken(token);
      }

      if (current.accessToken && (!current.portalConfigAt || Date.now() - current.portalConfigAt > PORTAL_CONFIG_REFRESH_MS)) {
        current = {
          ...current,
          portalUser: await getEffectivePortalUser(current.accessToken, current.email),
          portalConfigAt: Date.now(),
        };
      }

      return current;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      session.portalUser = token.portalUser;
      return session;
    },
  },
});
