import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-cc-webhook-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const webhookSecret = process.env.COINBASE_WEBHOOK_SECRET!;
    const computedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (computedSignature !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    const chargeId = event.event.data.id;
    const timeline = event.event.data.timeline;
    const latestStatus = timeline[timeline.length - 1]?.status;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (latestStatus === "CONFIRMED") {
      await supabase
        .from("transactions")
        .update({
          status: "confirmed",
          completed_at: new Date().toISOString(),
        })
        .eq("provider_transaction_id", chargeId);
    }

    if (latestStatus === "FAILED" || latestStatus === "EXPIRED") {
      await supabase
        .from("transactions")
        .update({
          status: "failed",
        })
        .eq("provider_transaction_id", chargeId);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}