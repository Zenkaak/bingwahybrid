import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth";
import { addFloat } from "@/lib/store-db";

const amountSchema = z.object({ amount: z.number().int().positive().max(1_000_000) });

export const Route = createFileRoute("/api/admin/float")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ ok: false }, { status: 401 });
        try {
          const { amount } = amountSchema.parse(await request.json());
          return Response.json({ ok: true, balance: await addFloat(amount) });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Could not add float." },
            { status: 400 },
          );
        }
      },
    },
  },
});
