import { createFileRoute } from "@tanstack/react-router";
import { isAdminRequest } from "@/lib/admin-auth";

export const Route = createFileRoute("/api/admin/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
          const authenticated = await isAdminRequest(request);
          return Response.json({ authenticated }, { status: authenticated ? 200 : 401 });
        },
    },
  },
});
