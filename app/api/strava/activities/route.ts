import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  fetchActivityById,
  fetchRecentActivities,
  refreshSession,
  sessionCookieName,
  setSessionCookie,
  shouldRefresh,
  unsealSession
} from "../../../lib/strava";

export async function GET() {
  const cookieStore = await cookies();
  let session = unsealSession(cookieStore.get(sessionCookieName)?.value);

  if (!session) {
    return NextResponse.json({ connected: false, activities: [] }, { status: 401 });
  }

  try {
    let refreshed = false;

    if (shouldRefresh(session)) {
      session = await refreshSession(session);
      refreshed = true;
    }

    const activeSession = session;
    const rawActivities = await fetchRecentActivities(activeSession.accessToken);
    const detailedActivities = await Promise.all(
      rawActivities.slice(0, 8).map(async (activity) => {
        const detail = await fetchActivityById(activeSession.accessToken, activity.id);
        return detail || activity;
      })
    );

    const activities = detailedActivities.map((activity) => ({
      id: activity.id,
      name: activity.name,
      type: activity.sport_type || activity.type,
      date: activity.start_date,
      minutes: Math.round(activity.moving_time / 60),
      distanceKm: Math.round((activity.distance / 1000) * 10) / 10,
      elevation: activity.total_elevation_gain || 0,
      calories: activity.calories || null
    }));

    const response = NextResponse.json({
      connected: true,
      refreshed,
      activities
    });

    if (refreshed) {
      setSessionCookie(response, session);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        connected: true,
        error: error instanceof Error ? error.message : "No se han podido cargar actividades.",
        activities: []
      },
      { status: 502 }
    );
  }
}
