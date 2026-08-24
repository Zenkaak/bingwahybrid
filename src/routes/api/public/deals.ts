import { createFileRoute } from "@tanstack/react-router";
import { getStoreSettings, listDeals } from "@/lib/store-db";

export const Route = createFileRoute("/api/public/deals")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [deals, settings] = await Promise.all([
            listDeals({ activeOnly: true }),
            getStoreSettings(),
          ]);
          return Response.json({
            ok: true,
            data: {
              deals,
              businessName: settings.businessName,
              supportPhone: settings.supportPhone,
            },
          });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Could not load deals." },
            { status: 500 },
          );
        }
      },
    },
  },
});
