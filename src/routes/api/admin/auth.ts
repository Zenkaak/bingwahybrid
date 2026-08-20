import { createFileRoute } from "@tanstack/react-router";
import { createAdminCookie, isCorrectPin, adminLogoutCookie } from "@/lib/admin-auth";

export const Route = createFileRoute("/api/admin/auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { pin?: unknown };
        if (typeof body.pin !== "string" || !(await isCorrectPin(body.pin))) {
          return Response.json({ ok: false, error: "Wrong PIN." }, { status: 401 });
        }
        return Response.json(
          { ok: true },
          { headers: { "Set-Cookie": await createAdminCookie() } },
        );
      },
      DELETE: () => Response.json({ ok: true }, { headers: { "Set-Cookie": adminLogoutCookie } }),
    },
  },
});
