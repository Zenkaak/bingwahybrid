import { createFileRoute } from "@tanstack/react-router";
import { performStkPush, performStkQuery, querySchema, stkSchema } from "@/lib/mpesa.functions";

export const Route = createFileRoute("/api/public/mpesa")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            action?: unknown;
            data?: unknown;
          };

          if (body.action === "stkPush") {
            return Response.json(await performStkPush(stkSchema.parse(body.data)));
          }

          if (body.action === "stkQuery") {
            return Response.json(await performStkQuery(querySchema.parse(body.data)));
          }

          return Response.json({ ok: false, error: "Unknown payment action." }, { status: 400 });
        } catch (error) {
          return Response.json(
            {
              ok: false,
              error: error instanceof Error ? error.message : "Invalid payment request.",
            },
            { status: 400 },
          );
        }
      },
    },
  },
});
