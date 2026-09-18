import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { getStravaAuthUrl, stateCookieName } from "../../../lib/strava";

export async function GET() {
  const state = crypto.randomBytes(24).toString("base64url");
  const cookieStore = await cookies();

  cookieStore.set(stateCookieName, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10
  });

  return NextResponse.redirect(getStravaAuthUrl(state));
}
