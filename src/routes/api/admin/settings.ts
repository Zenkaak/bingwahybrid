import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth";
import { getGatewaySettings, updateGatewaySettings } from "@/lib/store-db";

export const Route = createFileRoute("/api/admin/settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ ok: false }, { status: 401 });
        return Response.json({ ok: true, data: await getGatewaySettings() });
      },
      PUT: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ ok: false }, { status: 401 });
        const body = (await request.json().catch(() => ({}))) as {
          enabled?: unknown;
          till?: unknown;
        };
        const till = typeof body.till === "string" ? body.till.replace(/\D/g, "") : "";
        if (!/^\d{5,10}$/.test(till)) {
          return Response.json({ ok: false, error: "Enter a valid till number." }, { status: 400 });
        }
        return Response.json({
          ok: true,
          data: await updateGatewaySettings({ enabled: body.enabled === true, till }),
        });
      },
    },
  },
});
