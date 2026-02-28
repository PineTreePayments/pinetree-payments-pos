import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    console.log("🔥 WEBHOOK HIT");

    const body = await request.json();
    console.log("RAW BODY:", JSON.stringify(body, null, 2));

    const eventType = body.type;
    const eventId = body.id;

    console.log("EVENT TYPE:", eventType);
    console.log("EVENT ID:", eventId);

    if (!eventType) {
      console.log("❌ No event type found");
      return NextResponse.json({ received: true });
    }

    // Handle successful payments
    if (eventType === "charge:confirmed") {
      const chargeId = body.data?.id;

      console.log("✅ Charge Confirmed:", chargeId);

      // TODO: update your database here

    } else if (eventType === "charge:pending") {
      console.log("⏳ Charge Pending");

    } else {
      console.log("ℹ️ Other event type:", eventType);
    }

    return NextResponse.json({ received: true });

  } catch (err) {
    console.error("❌ WEBHOOK ERROR:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}