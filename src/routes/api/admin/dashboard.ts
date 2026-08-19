import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth";
import { getDashboardData } from "@/lib/store-db";

export const Route = createFileRoute("/api/admin/dashboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request))) {
          return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
        }
        try {
          return Response.json({ ok: true, data: await getDashboardData() });
        } catch (error) {
          return Response.json(
            {
              ok: false,
              error: error instanceof Error ? error.message : "Could not load dashboard.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
