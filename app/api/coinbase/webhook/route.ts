import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

    // Verify signature
    const hmac = crypto.createHmac("sha256", webhookSecret);
    hmac.update(rawBody);
    const computedSignature = hmac.digest("hex");

    if (computedSignature !== signature) {
      console.log("❌ Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    console.log("EVENT TYPE:", event.type);

    const charge = event.data;
    const chargeId = charge.id;

    console.log("CHARGE ID:", chargeId);
    console.log("STATUS:", charge.status);

    // Initialize Supabase INSIDE handler (prevents Vercel build crash)
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.log("❌ Supabase env vars missing");
      return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    if (event.type === "charge:confirmed" || event.type === "charge:resolved") {
      console.log("✅ Marking confirmed");

      await supabase
        .from("transactions")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        })
        .eq("provider_id", chargeId);
    }

    if (event.type === "charge:failed") {
      console.log("❌ Marking failed");

      await supabase
        .from("transactions")
        .update({
          status: "failed",
        })
        .eq("provider_id", chargeId);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.log("❌ WEBHOOK ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}