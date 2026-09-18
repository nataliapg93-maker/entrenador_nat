import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionCookieName, unsealSession } from "../../../lib/strava";

export async function GET() {
  const cookieStore = await cookies();
  const session = unsealSession(cookieStore.get(sessionCookieName)?.value);

  if (!session) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    athlete: session.athlete,
    scope: session.scope,
    connectedAt: session.connectedAt
  });
}
