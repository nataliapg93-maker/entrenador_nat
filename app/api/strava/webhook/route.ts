import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN && challenge) {
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return NextResponse.json({ error: "Webhook no verificado." }, { status: 403 });
}

export async function POST(request: Request) {
  const event = await request.json();

  // Aqui conectaremos la base de datos para guardar actividad creada/actualizada.
  console.info("Strava webhook recibido", event);

  return NextResponse.json({ received: true });
}
