import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { findOffer } from "@/lib/packages";
import { recordConfirmedSale } from "@/lib/store-db";

const saleSchema = z.object({
  offerId: z.string().min(1),
  paymentPhone: z.string().min(9).max(15),
  receivingPhone: z.string().min(9).max(15),
  paymentMode: z.enum(["mpesa", "float"]).default("mpesa"),
});

export const Route = createFileRoute("/api/public/sales")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = saleSchema.parse(await request.json());
          const offer = findOffer(input.offerId);
          if (!offer)
            return Response.json({ ok: false, error: "Offer not found." }, { status: 400 });
          const result = await recordConfirmedSale({
            ...input,
            offerId: offer.id,
            offerTitle: offer.title,
            service: offer.service,
            amount: offer.price,
          });
          return Response.json({ ok: true, data: result });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Could not save sale." },
            { status: 400 },
          );
        }
      },
    },
  },
});
