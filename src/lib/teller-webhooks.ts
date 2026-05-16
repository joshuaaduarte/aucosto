import { createHmac, timingSafeEqual } from "node:crypto";

export type TellerWebhookEvent = {
  id: string;
  type: string;
  timestamp: string;
  payload: {
    enrollment_id?: string;
    reason?: string;
    transactions?: Array<{
      id: string;
      account_id: string;
      amount: string;
      date: string;
      description: string;
      category?: string | null;
      status?: string | null;
      details?: {
        category?: string | null;
      } | null;
    }>;
    account_id?: string;
    status?: string;
  };
};

type ParsedSignatureHeader = {
  timestamp: number;
  signatures: string[];
};

function parseSignatureHeader(header: string | null): ParsedSignatureHeader | null {
  if (!header) return null;

  const parts = header.split(",").map((part) => part.trim()).filter(Boolean);
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, rawValue] = part.includes("=") ? part.split("=", 2) : [null, part];
    const value = rawValue?.trim();
    if (!value) continue;

    if (key === "t" || key === "timestamp") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) timestamp = parsed;
      continue;
    }

    if (key === "v1" || key === "signature" || key === "sig") {
      signatures.push(value);
      continue;
    }

    if (!key) signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

function getWebhookSecrets(): string[] {
  return (process.env.TELLER_WEBHOOK_SIGNING_SECRETS ?? "")
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function verifyTellerWebhookSignature(input: {
  header: string | null;
  rawBody: string;
  nowMs?: number;
}): { ok: true; event: TellerWebhookEvent } | { ok: false; error: string } {
  const parsedHeader = parseSignatureHeader(input.header);
  if (!parsedHeader) {
    return { ok: false, error: "Missing or malformed Teller-Signature header." };
  }

  const nowMs = input.nowMs ?? Date.now();
  if (Math.abs(nowMs - parsedHeader.timestamp * 1000) > 3 * 60 * 1000) {
    return { ok: false, error: "Teller webhook timestamp is too old or too far ahead." };
  }

  const secrets = getWebhookSecrets();
  if (secrets.length === 0) {
    return { ok: false, error: "TELLER_WEBHOOK_SIGNING_SECRETS is not configured." };
  }

  const signedMessage = `${parsedHeader.timestamp}.${input.rawBody}`;
  const matched = secrets.some((secret) => {
    const expected = createHmac("sha256", secret).update(signedMessage).digest("hex");
    return parsedHeader.signatures.some((signature) => {
      const left = Buffer.from(signature);
      const right = Buffer.from(expected);
      return left.length === right.length && timingSafeEqual(left, right);
    });
  });

  if (!matched) {
    return { ok: false, error: "Teller webhook signature verification failed." };
  }

  try {
    return { ok: true, event: JSON.parse(input.rawBody) as TellerWebhookEvent };
  } catch {
    return { ok: false, error: "Teller webhook JSON body is invalid." };
  }
}
