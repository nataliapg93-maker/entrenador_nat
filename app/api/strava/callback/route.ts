import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCodeForSession, getBaseUrl, setSessionCookie, stateCookieName } from "../../../lib/strava";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const returnedState = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(stateCookieName)?.value;
  const appUrl = new URL("/", getBaseUrl());

  cookieStore.delete(stateCookieName);

  if (error) {
    appUrl.searchParams.set("strava", "denied");
    return NextResponse.redirect(appUrl);
  }

  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    appUrl.searchParams.set("strava", "invalid_state");
    return NextResponse.redirect(appUrl);
  }

  try {
    const session = await exchangeCodeForSession(code);
    appUrl.searchParams.set("strava", "connected");
    const response = NextResponse.redirect(appUrl);
    setSessionCookie(response, session);
    return response;
  } catch {
    appUrl.searchParams.set("strava", "error");
    return NextResponse.redirect(appUrl);
  }
}
