import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth";
import { getStoreSettings, updateStoreSettings } from "@/lib/store-db";

export const Route = createFileRoute("/api/admin/settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ ok: false }, { status: 401 });
        try {
          return Response.json({ ok: true, data: await getStoreSettings() });
        } catch (error) {
          return Response.json(
            {
              ok: false,
              error: error instanceof Error ? error.message : "Could not load settings.",
            },
            { status: 500 },
          );
        }
      },
      PUT: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ ok: false }, { status: 401 });
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const digits = (value: unknown) =>
          typeof value === "string" ? value.replace(/\D/g, "") : "";
        const till = digits(body["till"]);
        const paybill = digits(body["paybill"]);
        const pin = digits(body["adminPin"]);

        if (till && !/^\d{5,10}$/.test(till)) {
          return Response.json({ ok: false, error: "Enter a valid till number." }, { status: 400 });
        }
        if (paybill && !/^\d{5,10}$/.test(paybill)) {
          return Response.json({ ok: false, error: "Enter a valid paybill number." }, { status: 400 });
        }
        if (pin && !/^\d{4,6}$/.test(pin)) {
          return Response.json({ ok: false, error: "PIN must be 4-6 digits." }, { status: 400 });
        }

        try {
          return Response.json({
            ok: true,
            data: await updateStoreSettings({
              ...(typeof body["enabled"] === "boolean" ? { enabled: body["enabled"] } : {}),
              ...(till ? { till } : {}),
              ...(paybill ? { paybill } : {}),
              ...(typeof body["businessName"] === "string" && body["businessName"].trim()
                ? { businessName: body["businessName"].trim() }
                : {}),
              ...(digits(body["supportPhone"]) ? { supportPhone: digits(body["supportPhone"]) } : {}),
              ...(pin ? { adminPin: pin } : {}),
            }),
          });
        } catch (error) {
          return Response.json(
            {
              ok: false,
              error: error instanceof Error ? error.message : "Could not save settings.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
