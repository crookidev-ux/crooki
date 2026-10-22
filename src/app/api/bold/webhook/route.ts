// Bold webhook (spec §7.4). Register in panel.bold.co → Integraciones → Webhooks
// as {site}/api/bold/webhook. Bold expects a 200 within ~2 s and retries
// otherwise, so: bad signature → 401, garbage with a valid signature → 200
// (retrying won't fix it), DB failure → 500 (retry; confirmAttempt is idempotent).
import { createAdminClient } from "@/lib/supabase/server";
import { isBoldConfigured, verifyWebhookSignature } from "@/lib/bold";
import { confirmAttempt } from "@/lib/payments";

const ok = () => Response.json({ received: true });

type BoldEvent = {
  id?: unknown;
  type?: unknown;
  data?: {
    payment_id?: unknown;
    amount?: { total?: unknown };
    metadata?: { reference?: unknown };
  };
};

export async function POST(request: Request) {
  if (!isBoldConfigured()) return Response.json({ error: "Bold is not configured" }, { status: 503 });

  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-bold-signature"), process.env.BOLD_SECRET_KEY!)) {
    console.warn("[bold/webhook] invalid signature");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: BoldEvent;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
    event = parsed as BoldEvent;
  } catch (e) {
    console.error("[bold/webhook] signed body is not a JSON object; ignored", e);
    return ok();
  }

  const type = typeof event.type === "string" ? event.type : "";
  const ref = event.data?.metadata?.reference;
  const total = event.data?.amount?.total;
  const paymentId = event.data?.payment_id;
  const log = `type=${type || "?"} ref=${typeof ref === "string" ? ref : "?"} event=${String(event.id ?? "?")}`;

  if (type !== "SALE_APPROVED" && type !== "SALE_REJECTED") {
    console.info(`[bold/webhook] ${log}: logged only`);
    return ok();
  }
  if (typeof ref !== "string" || !ref) {
    console.error(`[bold/webhook] ${log}: missing data.metadata.reference; ignored`);
    return ok();
  }

  try {
    const supabase = await createAdminClient();
    await confirmAttempt(
      supabase,
      ref,
      type === "SALE_APPROVED"
        ? {
            kind: "approved",
            amount: typeof total === "number" ? total : undefined,
            paymentId: typeof paymentId === "string" ? paymentId : undefined,
          }
        : { kind: "rejected", paymentId: typeof paymentId === "string" ? paymentId : undefined },
    );
    console.info(`[bold/webhook] ${log}: processed`);
    return ok();
  } catch (e) {
    console.error(`[bold/webhook] ${log}: processing failed; Bold will retry`, e);
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
