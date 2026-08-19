import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth";

export const Route = createFileRoute("/api/admin/me")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        Response.json(
          { authenticated: await isAdminRequest(request) },
          {
            status: (await isAdminRequest(request)) ? 200 : 401,
          },
        ),
    },
  },
});
