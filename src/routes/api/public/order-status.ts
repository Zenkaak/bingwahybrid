import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { performStkQuery } from "@/lib/mpesa.functions";
import { markSaleResult } from "@/lib/store-db";

const schema = z.object({
  saleId: z.string().min(1).max(60),
  checkoutRequestId: z.string().min(1).max(100).nullable().optional(),
});

export const Route = createFileRoute("/api/public/order-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = schema.parse(await request.json());
          if (!input.checkoutRequestId) {
            return Response.json({
              ok: true,
              data: { status: "pending", message: "Waiting for M-Pesa confirmation." },
            });
          }

          const result = await performStkQuery({ checkoutRequestId: input.checkoutRequestId });
          if (!result.ok) {
            return Response.json({
              ok: true,
              data: { status: "pending", message: result.error },
            });
          }

          if (result.status === "success") {
            const saved = await markSaleResult({
              saleId: input.saleId,
              status: "paid",
              resultDesc: result.message,
            });
            return Response.json({
              ok: true,
              data: { status: "paid", message: result.message, receipt: saved?.receipt ?? null },
            });
          }

          if (result.status === "failed") {
            await markSaleResult({
              saleId: input.saleId,
              status: "failed",
              resultDesc: result.message,
            });
          }

          return Response.json({ ok: true, data: { status: result.status, message: result.message } });
        } catch (error) {
          return Response.json(
            {
              ok: false,
              error: error instanceof Error ? error.message : "Could not check the payment.",
            },
            { status: 400 },
          );
        }
      },
    },
  },
});
