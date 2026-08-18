import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mpesa-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          console.log("M-Pesa callback", JSON.stringify(body));
        } catch {
          console.warn("M-Pesa callback: unreadable body");
        }
        return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
      },
    },
  },
});
