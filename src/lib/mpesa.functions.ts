import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const stkSchema = z.object({
  phone: z.string().min(9).max(15),
  amount: z.number().int().positive(),
  reference: z.string().min(1).max(20),
  description: z.string().min(1).max(60),
});

export const querySchema = z.object({
  checkoutRequestId: z.string().min(1).max(100),
});

type DarajaConfig = {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
  baseUrl: string;
  transactionType: "CustomerPayBillOnline" | "CustomerBuyGoodsOnline";
};

type DarajaErrorResponse = {
  errorMessage?: string;
  ResponseDescription?: string;
  ResultDesc?: string;
};

type DarajaJsonResponse = Record<string, unknown> & DarajaErrorResponse;

const DEFAULT_DARAJA_CALLBACK_URL = "https://bingwahybrid.vercel.app/api/public/mpesa-callback";

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

async function readDarajaResponse<T extends DarajaJsonResponse>(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    throw new Error(`M-Pesa returned an empty response (${response.status}).`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`M-Pesa returned an invalid response (${response.status}).`);
  }
}

function getDarajaConfig(): DarajaConfig | null {
  const consumerKey = process.env["DARAJA_CONSUMER_KEY"];
  const consumerSecret = process.env["DARAJA_CONSUMER_SECRET"];
  const shortcode = process.env["DARAJA_SHORTCODE"];
  const passkey = process.env["DARAJA_PASSKEY"];
  const callbackUrl = process.env["DARAJA_CALLBACK_URL"] || DEFAULT_DARAJA_CALLBACK_URL;

  if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
    return null;
  }

  const isProduction = process.env["DARAJA_ENV"] === "production";
  const accountType = process.env["DARAJA_ACCOUNT_TYPE"] === "paybill" ? "paybill" : "till";

  return {
    consumerKey,
    consumerSecret,
    shortcode,
    passkey,
    callbackUrl,
    baseUrl: `https://${isProduction ? "api" : "sandbox"}.safaricom.co.ke`,
    transactionType: accountType === "paybill" ? "CustomerPayBillOnline" : "CustomerBuyGoodsOnline",
  };
}

async function getAccessToken(config: DarajaConfig) {
  const response = await fetch(
    `${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${btoa(`${config.consumerKey}:${config.consumerSecret}`)}`,
      },
    },
  );
  const body = await readDarajaResponse<{ access_token?: string } & DarajaJsonResponse>(response);

  if (!response.ok || !body.access_token) {
    throw new Error(body.errorMessage ?? "Could not authenticate with M-Pesa.");
  }

  return body.access_token;
}

function timestamp() {
  return new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
}

export type StkInput = z.infer<typeof stkSchema>;
export type QueryInput = z.infer<typeof querySchema>;

export async function performStkPush(data: StkInput) {
  const config = getDarajaConfig();
  if (!config) {
    return { ok: false as const, error: "M-Pesa credentials are not configured yet." };
  }

  try {
    const accessToken = await getAccessToken(config);
    const stamp = timestamp();
    const password = btoa(`${config.shortcode}${config.passkey}${stamp}`);
    const phone = normalizePhone(data.phone);

    const response = await fetch(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: config.shortcode,
        Password: password,
        Timestamp: stamp,
        TransactionType: config.transactionType,
        Amount: data.amount,
        PartyA: phone,
        PartyB: config.shortcode,
        PhoneNumber: phone,
        CallBackURL: config.callbackUrl,
        AccountReference: data.reference,
        TransactionDesc: data.description,
      }),
    });

    const json = await readDarajaResponse<
      {
        ResponseCode?: string;
        CheckoutRequestID?: string;
      } & DarajaJsonResponse
    >(response);

    if (json.ResponseCode === "0") {
      return { ok: true as const, checkoutRequestId: json.CheckoutRequestID ?? null };
    }
    return {
      ok: false as const,
      error: json.errorMessage ?? json.ResponseDescription ?? "M-Pesa request failed.",
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Could not reach M-Pesa. Try again.",
    };
  }
}

export async function performStkQuery(data: QueryInput) {
  const config = getDarajaConfig();
  if (!config) {
    return { ok: false as const, error: "M-Pesa credentials are not configured yet." };
  }

  try {
    const accessToken = await getAccessToken(config);
    const stamp = timestamp();
    const response = await fetch(`${config.baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: config.shortcode,
        Password: btoa(`${config.shortcode}${config.passkey}${stamp}`),
        Timestamp: stamp,
        CheckoutRequestID: data.checkoutRequestId,
      }),
    });
    const json = await readDarajaResponse<
      {
        ResponseCode?: string;
        ResultCode?: string;
      } & DarajaJsonResponse
    >(response);

    if (json.ResponseCode !== "0") {
      return {
        ok: false as const,
        error: json.errorMessage ?? json.ResponseDescription ?? "Could not check payment status.",
      };
    }

    if (json.ResultCode === "0") {
      return {
        ok: true as const,
        status: "success" as const,
        message: "Payment confirmed.",
      };
    }

    if (json.ResultCode && json.ResultCode !== "1037") {
      return {
        ok: true as const,
        status: "failed" as const,
        message: json.ResultDesc ?? "The M-Pesa payment was not completed.",
      };
    }

    return {
      ok: true as const,
      status: "pending" as const,
      message: "Waiting for M-Pesa confirmation.",
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Could not check payment status.",
    };
  }
}

export const stkPush = createServerFn({ method: "POST" })
  .validator((data: unknown) => stkSchema.parse(data))
  .handler(({ data }) => performStkPush(data));

export const queryStk = createServerFn({ method: "POST" })
  .validator((data: unknown) => querySchema.parse(data))
  .handler(({ data }) => performStkQuery(data));
