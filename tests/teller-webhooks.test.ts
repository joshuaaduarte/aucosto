import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyTellerWebhookSignature } from "@/lib/teller-webhooks";

describe("teller-webhooks", () => {
  afterEach(() => {
    delete process.env.TELLER_WEBHOOK_SIGNING_SECRETS;
  });

  it("verifies a valid Teller webhook signature", () => {
    process.env.TELLER_WEBHOOK_SIGNING_SECRETS = "secret_123";
    const rawBody = JSON.stringify({
      id: "evt_1",
      type: "webhook.test",
      timestamp: "2026-05-16T00:00:00.000Z",
      payload: {},
    });
    const timestamp = 1_778_889_600;
    const signature = createHmac("sha256", "secret_123")
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const result = verifyTellerWebhookSignature({
      header: `t=${timestamp},v1=${signature}`,
      rawBody,
      nowMs: timestamp * 1000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.type).toBe("webhook.test");
    }
  });

  it("rejects stale webhook timestamps", () => {
    process.env.TELLER_WEBHOOK_SIGNING_SECRETS = "secret_123";
    const rawBody = JSON.stringify({ id: "evt_1", type: "webhook.test", timestamp: "", payload: {} });
    const timestamp = 1_700_000_000;
    const signature = createHmac("sha256", "secret_123")
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const result = verifyTellerWebhookSignature({
      header: `t=${timestamp},v1=${signature}`,
      rawBody,
      nowMs: timestamp * 1000 + 4 * 60 * 1000,
    });

    expect(result).toEqual({
      ok: false,
      error: "Teller webhook timestamp is too old or too far ahead.",
    });
  });
});
