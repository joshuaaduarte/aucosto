import "server-only";
import { request } from "node:https";
import { URL } from "node:url";

export type TellerEnvironment = "sandbox" | "development" | "production";

export type TellerAccount = {
  id: string;
  name: string;
  type: string;
  subtype?: string | null;
  currency?: string | null;
  status?: string | null;
  last_four?: string | null;
  enrollment_id: string;
  institution?: {
    id?: string;
    name?: string;
  } | null;
};

export type TellerBalance = {
  account_id: string;
  available?: string | null;
  ledger?: string | null;
};

export type TellerTransaction = {
  id: string;
  account_id: string;
  amount: string;
  date: string;
  description: string;
  category?: string | null;
  status?: string | null;
  running_balance?: string | null;
  details?: {
    category?: string | null;
    counterparty?: {
      name?: string | null;
      type?: string | null;
    } | null;
    processing_status?: string | null;
  } | null;
};

function normalizeMultilineSecret(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

export function getTellerConnectConfig(): {
  enabled: boolean;
  applicationId?: string;
  environment: TellerEnvironment;
  reason?: string;
} {
  const applicationId = process.env.TELLER_APPLICATION_ID?.trim();
  const environment = (process.env.TELLER_ENV?.trim() || "development") as TellerEnvironment;
  const cert = normalizeMultilineSecret(process.env.TELLER_CERT_PEM);
  const key = normalizeMultilineSecret(process.env.TELLER_PRIVATE_KEY_PEM);

  if (!applicationId) {
    return {
      enabled: false,
      environment,
      reason: "TELLER_APPLICATION_ID is not configured.",
    };
  }

  if (environment !== "sandbox" && (!cert || !key)) {
    return {
      enabled: false,
      applicationId,
      environment,
      reason: "TELLER_CERT_PEM and TELLER_PRIVATE_KEY_PEM are required outside sandbox.",
    };
  }

  return { enabled: true, applicationId, environment };
}

function tellerRequest<T>(
  path: string,
  accessToken: string,
  searchParams?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(path, "https://api.teller.io");
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  const cert = normalizeMultilineSecret(process.env.TELLER_CERT_PEM);
  const key = normalizeMultilineSecret(process.env.TELLER_PRIVATE_KEY_PEM);
  const environment = (process.env.TELLER_ENV?.trim() || "development") as TellerEnvironment;

  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        cert: cert || undefined,
        key: key || undefined,
        headers: {
          Authorization: `Basic ${Buffer.from(`${accessToken}:`).toString("base64")}`,
          Accept: "application/json",
        },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          const status = res.statusCode ?? 500;
          if (status < 200 || status >= 300) {
            reject(
              new Error(
                `Teller request failed (${status})${body ? `: ${body.slice(0, 240)}` : ""}`,
              ),
            );
            return;
          }

          try {
            resolve(JSON.parse(body) as T);
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    req.on("error", reject);

    if (environment === "sandbox" && !cert && !key) {
      // no-op: sandbox allows requests without client certificates.
    }

    req.end();
  });
}

export async function tellerListAccounts(accessToken: string): Promise<TellerAccount[]> {
  return tellerRequest<TellerAccount[]>("/accounts", accessToken);
}

export async function tellerGetBalances(
  accessToken: string,
  accountId: string,
): Promise<TellerBalance> {
  return tellerRequest<TellerBalance>(`/accounts/${accountId}/balances`, accessToken);
}

export async function tellerListTransactions(
  accessToken: string,
  accountId: string,
  options: { startDate?: string; endDate?: string; count?: number; fromId?: string } = {},
): Promise<TellerTransaction[]> {
  return tellerRequest<TellerTransaction[]>(`/accounts/${accountId}/transactions`, accessToken, {
    start_date: options.startDate,
    end_date: options.endDate,
    count: options.count ? String(options.count) : undefined,
    from_id: options.fromId,
  });
}
