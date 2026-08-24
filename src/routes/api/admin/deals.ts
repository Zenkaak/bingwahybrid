import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth";
import { deleteDeal, listDeals, saveDeal } from "@/lib/store-db";

const dealSchema = z.object({
  id: z.string().min(2).max(40),
  groupKey: z.enum(["bingwa", "repeatable", "minutes", "sms"]),
  title: z.string().min(1).max(60),
  price: z.number().int().positive().max(100000),
  validity: z.string().min(1).max(60),
  note: z.string().max(120).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
});

export const Route = createFileRoute("/api/admin/deals")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ ok: false }, { status: 401 });
        try {
          return Response.json({ ok: true, data: await listDeals() });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Could not load deals." },
            { status: 500 },
          );
        }
      },
      PUT: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ ok: false }, { status: 401 });
        try {
          const input = dealSchema.parse(await request.json());
          return Response.json({
            ok: true,
            data: await saveDeal({
              id: input.id,
              groupKey: input.groupKey,
              title: input.title,
              price: input.price,
              validity: input.validity,
              note: input.note ?? null,
              sortOrder: input.sortOrder ?? 0,
              active: input.active ?? true,
            }),
          });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Could not save the deal." },
            { status: 400 },
          );
        }
      },
      DELETE: async ({ request }) => {
        if (!(await isAdminRequest(request))) return Response.json({ ok: false }, { status: 401 });
        try {
          const body = (await request.json().catch(() => ({}))) as { id?: unknown };
          if (typeof body.id !== "string" || !body.id) {
            return Response.json({ ok: false, error: "Missing deal id." }, { status: 400 });
          }
          return Response.json({ ok: true, data: await deleteDeal(body.id) });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Could not delete the deal." },
            { status: 400 },
          );
        }
      },
    },
  },
});
