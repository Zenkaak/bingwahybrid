import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const stkSchema = z.object({
  phone: z.string().min(9),
  amount: z.number().int().positive(),
  reference: z.string().min(1).max(20),
  description: z.string().min(1).max(60),
});

function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

export const stkPush = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => stkSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env["DARAJA_CONSUMER_KEY"];
    const secret = process.env["DARAJA_CONSUMER_SECRET"];
    const shortcode = process.env["DARAJA_SHORTCODE"];
    const passkey = process.env["DARAJA_PASSKEY"];
    const env = process.env["DARAJA_ENV"] === "production" ? "api" : "sandbox";
    const callbackUrl =
      process.env["DARAJA_CALLBACK_URL"] ?? "https://example.com/api/public/mpesa-callback";

    if (!key || !secret || !shortcode || !passkey) {
      return { ok: false as const, error: "M-Pesa credentials are not configured yet." };
    }

    try {
      const tokenRes = await fetch(
        `https://${env}.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { Authorization: `Basic ${btoa(`${key}:${secret}`)}` } },
      );
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token) {
        return { ok: false as const, error: "Could not authenticate with M-Pesa." };
      }

      const stamp = new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, "")
        .slice(0, 14);
      const password = btoa(`${shortcode}${passkey}${stamp}`);
      const phone = normalizePhone(data.phone);

      const res = await fetch(`https://${env}.safaricom.co.ke/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenJson.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: stamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: data.amount,
          PartyA: phone,
          PartyB: shortcode,
          PhoneNumber: phone,
          CallBackURL: callbackUrl,
          AccountReference: data.reference,
          TransactionDesc: data.description,
        }),
      });

      const json = (await res.json()) as {
        ResponseCode?: string;
        CheckoutRequestID?: string;
        errorMessage?: string;
        ResponseDescription?: string;
      };

      if (json.ResponseCode === "0") {
        return { ok: true as const, checkoutRequestId: json.CheckoutRequestID ?? null };
      }
      console.error("STK push failed", json);
      return {
        ok: false as const,
        error: json.errorMessage ?? json.ResponseDescription ?? "M-Pesa request failed.",
      };
    } catch (err) {
      console.error("STK push error", err);
      return { ok: false as const, error: "Could not reach M-Pesa. Try again." };
    }
  });
