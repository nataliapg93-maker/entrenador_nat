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

// Si el movil no guarda la sesion, cada visita crearia un usuario nuevo
// y el historial anterior quedaria invisible. Mejor detectarlo y avisar.
let storageWorks = true;

export function isStorageWorking() {
  return storageWorks;
}

function writeSession(session: Session | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (session) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      storageWorks = Boolean(window.localStorage.getItem(SESSION_KEY));
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Navegacion privada o almacenamiento bloqueado.
    storageWorks = false;
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

// Entra sin email ni contrasena. Supabase crea un usuario anonimo real,
// asi que las reglas de seguridad por fila siguen aplicando igual.
export async function signInAnonymously(): Promise<Session> {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify({})
  }).catch(() => null);

  if (!response) {
    throw new Error("Sin conexion con la base de datos. Revisa tu cobertura.");
  }

  if (!response.ok) {
    const details = await response.text();

    if (details.includes("anonymous_provider_disabled")) {
      throw new Error(
        "Falta activar el acceso anonimo en Supabase: Authentication, Sign In / Providers, Anonymous sign-ins."
      );
    }

    throw new Error(`No se ha podido abrir la sesion: ${details}`);
  }

  const session = normalizeSession(await response.json());

  if (!session.access_token) {
    throw new Error("Supabase no ha devuelto una sesion valida.");
  }

  writeSession(session);
  return session;
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
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  }).catch(() => null);

  // Sin cobertura o servidor caido. No cerramos la sesion por esto.
  if (!response) {
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

type RestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export async function restFetch(path: string, init: RestOptions = {}) {
  const session = await ensureSession();

  if (!session) {
    throw new Error("Sesion caducada. Vuelve a entrar con tu email.");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: init.method || "GET",
    body: init.body,
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

// --- Fotos de comida --------------------------------------------------
// El almacen es privado. Se sube con la sesion de la usuaria, y para
// mostrarlas hay que pedir enlaces firmados con caducidad.

export async function uploadFile(bucket: string, path: string, file: File) {
  const session = await ensureSession();

  if (!session) {
    throw new Error("Sesion caducada. Recarga la pagina.");
  }

  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${session.access_token}`,
      "content-type": file.type || "application/octet-stream",
      "x-upsert": "true"
    },
    body: file
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Error ${response.status} al subir la foto.`);
  }
}

export async function signPaths(
  bucket: string,
  paths: string[],
  expiresIn = 60 * 60
): Promise<Record<string, string>> {
  if (paths.length === 0) {
    return {};
  }

  const session = await ensureSession();

  if (!session) {
    return {};
  }

  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${bucket}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ expiresIn, paths })
  }).catch(() => null);

  if (!response || !response.ok) {
    // Sin foto se sigue viendo la comida. No vale la pena romper la pantalla.
    return {};
  }

  const rows = (await response.json()) as Array<{ path?: string; signedURL?: string }>;
  const map: Record<string, string> = {};

  for (const row of rows) {
    if (row.path && row.signedURL) {
      map[row.path] = `${SUPABASE_URL}/storage/v1${row.signedURL}`;
    }
  }

  return map;
}
