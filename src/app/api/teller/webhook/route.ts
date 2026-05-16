import { handleTellerWebhookEvent } from "@/lib/services/finance";
import { verifyTellerWebhookSignature } from "@/lib/teller-webhooks";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const verification = verifyTellerWebhookSignature({
    header: request.headers.get("Teller-Signature"),
    rawBody,
  });

  if (!verification.ok) {
    return Response.json({ ok: false, error: verification.error }, { status: 401 });
  }

  await handleTellerWebhookEvent(verification.event);
  return Response.json({ ok: true });
}
