import crypto from "crypto";
import type { NextResponse } from "next/server";

export type StravaAthlete = {
  id: number;
  firstname?: string;
  lastname?: string;
  profile?: string;
};

export type StravaTokenResponse = {
  token_type: "Bearer";
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  scope?: string;
  athlete?: StravaAthlete;
};

export type StravaSession = {
  athlete: StravaAthlete | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
  connectedAt: string;
};

export type StravaActivity = {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  start_date: string;
  moving_time: number;
  elapsed_time: number;
  distance: number;
  total_elevation_gain?: number;
  kilojoules?: number;
  calories?: number;
};

export const sessionCookieName = "natalia_strava_session";
export const stateCookieName = "natalia_strava_oauth_state";

const tokenEndpoint = "https://www.strava.com/oauth/token";
const activitiesEndpoint = "https://www.strava.com/api/v3/athlete/activities";
const activityEndpoint = "https://www.strava.com/api/v3/activities";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta configurar ${name}`);
  }
  return value;
}

export function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export function getRedirectUri() {
  return process.env.STRAVA_REDIRECT_URI || `${getBaseUrl()}/api/strava/callback`;
}

export function getStravaAuthUrl(state: string) {
  const clientId = requiredEnv("STRAVA_CLIENT_ID");
  const scope = process.env.STRAVA_SCOPES || "read,activity:read_all";
  const url = new URL("https://www.strava.com/oauth/authorize");

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);

  return url;
}

async function requestToken(params: Record<string, string>) {
  const body = new URLSearchParams({
    client_id: requiredEnv("STRAVA_CLIENT_ID"),
    client_secret: requiredEnv("STRAVA_CLIENT_SECRET"),
    ...params
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Strava no ha aceptado la autorizacion: ${details}`);
  }

  return (await response.json()) as StravaTokenResponse;
}

export async function exchangeCodeForSession(code: string) {
  const token = await requestToken({
    code,
    grant_type: "authorization_code"
  });

  return tokenToSession(token);
}

export async function refreshSession(session: StravaSession) {
  const token = await requestToken({
    grant_type: "refresh_token",
    refresh_token: session.refreshToken
  });

  return tokenToSession(token, session.athlete);
}

export function shouldRefresh(session: StravaSession) {
  const now = Math.floor(Date.now() / 1000);
  return session.expiresAt - now < 300;
}

function tokenToSession(token: StravaTokenResponse, fallbackAthlete?: StravaAthlete | null): StravaSession {
  return {
    athlete: token.athlete || fallbackAthlete || null,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: token.expires_at,
    scope: token.scope,
    connectedAt: new Date().toISOString()
  };
}

export async function fetchRecentActivities(accessToken: string) {
  const url = new URL(activitiesEndpoint);
  url.searchParams.set("per_page", "12");
  url.searchParams.set("page", "1");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`No se han podido leer actividades de Strava: ${details}`);
  }

  return (await response.json()) as StravaActivity[];
}

export async function fetchActivityById(accessToken: string, id: number) {
  const response = await fetch(`${activityEndpoint}/${id}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as StravaActivity;
}

function getCookieKey() {
  return crypto.createHash("sha256").update(requiredEnv("STRAVA_COOKIE_SECRET")).digest();
}

export function sealSession(session: StravaSession) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getCookieKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function unsealSession(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const raw = Buffer.from(value, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", getCookieKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    return JSON.parse(decrypted) as StravaSession;
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, session: StravaSession) {
  response.cookies.set(sessionCookieName, sealSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}
