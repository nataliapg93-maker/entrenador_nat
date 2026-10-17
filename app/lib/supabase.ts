"use client";

// Cliente minimo de Supabase por HTTP. Sin dependencias nuevas.
// Mismo estilo que el resto del proyecto, que ya usa fetch directo.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const SESSION_KEY = "natalia-fit-session";

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // segundos epoch
  user: { id: string; email?: string };
};

export function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

export function readSession(): Session | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeSession(session: Session | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (session) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Navegador en modo privado o almacenamiento bloqueado. Seguimos sin persistir.
  }
}

function normalizeSession(raw: Record<string, unknown>): Session {
  const expiresIn = Number(raw.expires_in) || 3600;
  const expiresAt = Number(raw.expires_at) || Math.floor(Date.now() / 1000) + expiresIn;
  const user = (raw.user as Session["user"]) || { id: "" };

  return {
    access_token: String(raw.access_token || ""),
    refresh_token: String(raw.refresh_token || ""),
    expires_at: expiresAt,
    user: { id: user.id, email: user.email }
  };
}

// --- Autenticacion -------------------------------------------------

export async function sendMagicLink(email: string) {
  const redirectTo = encodeURIComponent(window.location.origin);
  const response = await fetch(`${SUPABASE_URL}/auth/v1/otp?redirect_to=${redirectTo}`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify({ email, create_user: true })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`No se ha podido enviar el enlace: ${details}`);
  }
}

// Lee los tokens que Supabase deja en el fragmento de la URL al volver del email.
export function captureSessionFromUrl(): Session | null {
  if (typeof window === "undefined" || !window.location.hash) {
    return null;
  }

  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return null;
  }

  const session = normalizeSession({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: Number(params.get("expires_in")) || 3600,
    user: { id: "", email: undefined }
  });

  writeSession(session);
  window.history.replaceState({}, "", window.location.pathname + window.location.search);
  return session;
}

async function refreshSession(session: Session): Promise<Session | null> {
  let response: Response;

  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: SUPABASE_KEY },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
  } catch {
    // Sin cobertura o servidor caido. No cerramos la sesion por esto.
    return session;
  }

  if (!response.ok) {
    // Solo cerramos sesion si el servidor rechaza el token de verdad.
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      writeSession(null);
      return null;
    }

    return session;
  }

  const next = normalizeSession(await response.json());

  if (!next.user.id && session.user.id) {
    next.user = session.user;
  }

  writeSession(next);
  return next;
}

// Devuelve una sesion con token valido, refrescando si hace falta.
export async function ensureSession(): Promise<Session | null> {
  const session = readSession();
  if (!session) {
    return null;
  }

  const marginSeconds = 60;
  if (session.expires_at - marginSeconds > Math.floor(Date.now() / 1000)) {
    return session;
  }

  return refreshSession(session);
}

export async function loadUser(session: Session): Promise<Session> {
  if (session.user.id) {
    return session;
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${session.access_token}` }
  });

  if (!response.ok) {
    return session;
  }

  const user = (await response.json()) as { id: string; email?: string };
  const next = { ...session, user: { id: user.id, email: user.email } };
  writeSession(next);
  return next;
}

export function signOut() {
  writeSession(null);
}

// --- Acceso a datos ------------------------------------------------

export async function restFetch(path: string, init: RequestInit = {}) {
  const session = await ensureSession();

  if (!session) {
    throw new Error("Sesion caducada. Vuelve a entrar con tu email.");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${session.access_token}`,
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Error ${response.status} al hablar con la base de datos.`);
  }

  const body = await response.text();

  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
