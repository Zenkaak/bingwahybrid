import { createFileRoute } from "@tanstack/react-router";
import { markSaleResult } from "@/lib/store-db";

type CallbackItem = { Name?: string; Value?: string | number };

export const Route = createFileRoute("/api/public/mpesa-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            Body?: {
              stkCallback?: {
                CheckoutRequestID?: string;
                ResultCode?: number | string;
                ResultDesc?: string;
                CallbackMetadata?: { Item?: CallbackItem[] };
              };
            };
          };
          const callback = body.Body?.stkCallback;
          if (callback?.CheckoutRequestID) {
            const items = callback.CallbackMetadata?.Item ?? [];
            const receipt = items.find((item) => item.Name === "MpesaReceiptNumber")?.Value;
            const success = String(callback.ResultCode ?? "") === "0";
            await markSaleResult({
              checkoutRequestId: callback.CheckoutRequestID,
              status: success ? "paid" : "failed",
              receipt: receipt ? String(receipt) : null,
              resultDesc: callback.ResultDesc ?? null,
            });
          }
        } catch (error) {
          console.warn("M-Pesa callback could not be processed", error);
        }
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
