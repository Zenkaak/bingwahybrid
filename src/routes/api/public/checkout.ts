import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { performStkPush } from "@/lib/mpesa.functions";
import { createPendingSale, getDeal, normalizePhone } from "@/lib/store-db";

const schema = z.object({
  dealId: z.string().min(1).max(40),
  paymentPhone: z.string().min(9).max(15),
  receivingPhone: z.string().min(9).max(15).optional(),
});

export const Route = createFileRoute("/api/public/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = schema.parse(await request.json());
          const deal = await getDeal(input.dealId);
          if (!deal || !deal.active) {
            return Response.json({ ok: false, error: "That deal is not available." }, { status: 404 });
          }

          const paymentPhone = normalizePhone(input.paymentPhone);
          const receivingPhone = normalizePhone(input.receivingPhone || input.paymentPhone);
          if (paymentPhone.length !== 12) {
            return Response.json({ ok: false, error: "Enter a valid M-Pesa number." }, { status: 400 });
          }

          const push = await performStkPush({
            phone: paymentPhone,
            amount: deal.price,
            reference: deal.groupKey.slice(0, 20),
            description: `${deal.title} ${deal.validity}`.slice(0, 60),
          });

          if (!push.ok) {
            return Response.json({ ok: false, error: push.error }, { status: 502 });
          }

          const sale = await createPendingSale({
            deal,
            paymentPhone,
            receivingPhone,
            checkoutRequestId: push.checkoutRequestId,
          });

          return Response.json({
            ok: true,
            data: { saleId: sale.id, checkoutRequestId: push.checkoutRequestId },
          });
        } catch (error) {
          return Response.json(
            {
              ok: false,
              error: error instanceof Error ? error.message : "Could not start the purchase.",
            },
            { status: 400 },
          );
        }
      },
    },
  },
});
