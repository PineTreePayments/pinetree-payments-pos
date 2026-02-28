import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    const signature =
      req.headers.get("x-cc-webhook-signature") ||
      req.headers.get("X-CC-Webhook-Signature");

    if (!signature) {
      console.error("Missing Coinbase signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const webhookSecret = process.env.COINBASE_WEBHOOK_SECRET!;

    const computedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (computedSignature !== signature) {
      console.error("Invalid Coinbase signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const charge = event?.event?.data;

    if (!charge?.id) {
      return NextResponse.json({ received: false }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const timeline = charge.timeline || [];
    const latestStatus = timeline[timeline.length - 1]?.status;

    if (latestStatus === "CONFIRMED") {
      await supabase
        .from("transactions")
        .update({
          status: "confirmed",
          completed_at: new Date().toISOString(),
        })
        .eq("provider_transaction_id", charge.id);
    }

    if (latestStatus === "FAILED" || latestStatus === "EXPIRED") {
      await supabase
        .from("transactions")
        .update({
          status: "failed",
        })
        .eq("provider_transaction_id", charge.id);
    }

    return NextResponse.json({ received: true });
    
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}