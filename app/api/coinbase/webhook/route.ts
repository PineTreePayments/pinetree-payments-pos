import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  console.log("🔥 WEBHOOK HIT");

  try {
    const rawBody = await request.text();
    console.log("RAW BODY:", rawBody);

    const signature = request.headers.get("x-cc-webhook-signature");
    const webhookSecret = process.env.COINBASE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      console.log("❌ Missing signature or webhook secret");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    // Verify Coinbase signature
    const hmac = crypto.createHmac("sha256", webhookSecret);
    hmac.update(rawBody);
    const computedSignature = hmac.digest("hex");

    if (computedSignature !== signature) {
      console.log("❌ Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    console.log("EVENT TYPE:", event.type);

    const charge = event.data;
    const chargeId = charge.id;

    console.log("CHARGE ID:", chargeId);
    console.log("STATUS:", charge.status);

    if (!chargeId) {
      console.log("❌ No charge ID found");
      return NextResponse.json({ ok: true });
    }

    // We only care about confirmed / resolved
    if (
      event.type === "charge:confirmed" ||
      event.type === "charge:resolved"
    ) {
      console.log("✅ Marking transaction as confirmed");

      const { error } = await supabase
        .from("transactions")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        })
        .eq("provider_id", chargeId);

      if (error) {
        console.log("❌ Supabase update error:", error);
      } else {
        console.log("✅ Supabase updated successfully");
      }
    } else if (event.type === "charge:failed") {
      console.log("❌ Marking transaction as failed");

      await supabase
        .from("transactions")
        .update({
          status: "failed",
        })
        .eq("provider_id", chargeId);
    } else {
      console.log("ℹ️ Ignoring event type:", event.type);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.log("❌ WEBHOOK ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
