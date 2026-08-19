import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth";
import { requestCommissionWithdrawal } from "@/lib/store-db";

export const Route = createFileRoute("/api/admin/withdraw")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ ok: false }, { status: 401 });
        const result = await requestCommissionWithdrawal();
        if (!result.amount) {
          return Response.json(
            { ok: false, error: "No KES 10 commission block is ready yet." },
            { status: 400 },
          );
        }
        return Response.json({ ok: true, amount: result.amount });
      },
    },
  },
});
