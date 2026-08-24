import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";

const POLL_ATTEMPTS = 12;
const POLL_DELAY_MS = 3000;
const DEFAULT_SUPPORT_PHONE = "0769252572";

type Deal = {
  id: string;
  groupKey: string;
  title: string;
  price: number;
  validity: string;
  note: string | null;
  sortOrder: number;
  active: boolean;
};

const GROUPS: Array<{ key: string; name: string; tagline: string; icon: string }> = [
  { key: "bingwa", name: "Bingwa Data Deals", tagline: "Buy once per day per line", icon: "🔂" },
  { key: "repeatable", name: "Repeatable Deals", tagline: "Buy as many times as you like", icon: "♻️" },
  { key: "minutes", name: "Minutes Deals", tagline: "Purchase multiple times", icon: "📞" },
  { key: "sms", name: "SMS Deals", tagline: "Stay in touch for less", icon: "💬" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TIM'S DATA SOLUTIONS — Data, SMS & Minutes Deals" },
      {
        name: "description",
        content:
          "Buy affordable data, SMS and minutes deals instantly with M-Pesa from TIM'S DATA SOLUTIONS.",
      },
      { property: "og:title", content: "TIM'S DATA SOLUTIONS — Data, SMS & Minutes Deals" },
      {
        property: "og:description",
        content: "Instant data, SMS and minutes deals paid straight from M-Pesa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Storefront,
});

function Storefront() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [businessName, setBusinessName] = useState("TIM'S DATA SOLUTIONS");
  const [supportPhone, setSupportPhone] = useState(DEFAULT_SUPPORT_PHONE);
  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [mode, setMode] = useState<"mine" | "other">("mine");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  const loadDeals = useCallback(async () => {
    try {
      const response = await fetch("/api/public/deals");
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        data?: { deals?: Deal[]; businessName?: string; supportPhone?: string };
      };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Could not load deals.");
      setDeals(body.data?.deals ?? []);
      if (body.data?.businessName) setBusinessName(body.data.businessName);
      if (body.data?.supportPhone) setSupportPhone(body.data.supportPhone);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load deals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDeals();
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, [loadDeals]);

  function openDeal(next: Deal) {
    setDeal(next);
    setMode("mine");
    setPhone("");
    setStatusText(null);
  }

  async function buy() {
    if (!deal) return;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) {
      toast.error("Enter a valid M-Pesa number.");
      return;
    }
    setBusy(true);
    setStatusText("Sending the M-Pesa prompt…");
    try {
      const started = await fetch("/api/public/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dealId: deal.id, paymentPhone: digits }),
      });
      const startBody = (await started.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        data?: { saleId: string; checkoutRequestId: string | null };
      };
      if (!started.ok || !startBody.ok || !startBody.data)
        throw new Error(startBody.error ?? "Could not start the purchase.");

      setStatusText("Enter your M-Pesa PIN on your phone…");
      const { saleId, checkoutRequestId } = startBody.data;

      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));
        const response = await fetch("/api/public/order-status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ saleId, checkoutRequestId }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          data?: { status?: string; message?: string; receipt?: string | null };
        };
        const status = body.data?.status;
        if (status === "paid") {
          toast.success(
            `Payment confirmed. ${deal.title} is on the way to ${digits}.${
              body.data?.receipt ? ` Ref ${body.data.receipt}` : ""
            }`,
          );
          setDeal(null);
          return;
        }
        if (status === "failed") throw new Error(body.data?.message ?? "The payment was not completed.");
      }

      toast.info("Prompt sent. Confirmation is taking longer than usual — we will deliver once paid.");
      setDeal(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete the purchase.");
    } finally {
      setBusy(false);
      setStatusText(null);
    }
  }

  const telHref = `tel:${supportPhone.replace(/\s/g, "")}`;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-28">
      <Toaster />
      <header className="pt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
          {businessName}
        </p>
        <h1 className="mt-2 text-3xl font-bold">Data, SMS &amp; minutes deals</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a deal, pay with the M-Pesa prompt, and it is delivered to your line instantly.
        </p>
      </header>

      <div className="mt-6 rounded-2xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
        <Badge>Secure M-Pesa prompt</Badge>
        <p className="mt-2">
          Payment is verified with an M-Pesa reference code before the bundle is recorded for
          delivery.
        </p>
      </div>

      {loading ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">Loading deals…</p>
      ) : null}

      {GROUPS.map((group) => {
        const items = deals.filter((item) => item.groupKey === group.key);
        if (!items.length) return null;
        return (
          <section key={group.key} className="mt-8">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold">
                <span className="mr-2">{group.icon}</span>
                {group.name}
              </h2>
              <span className="text-[11px] text-muted-foreground">{group.tagline}</span>
            </div>
            <div className="mt-3 space-y-3">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="surface-card flex items-center gap-4 rounded-2xl p-4"
                >
                  <div className="gradient-primary flex size-14 shrink-0 flex-col items-center justify-center rounded-xl text-primary-foreground">
                    <span className="text-[10px] font-semibold opacity-80">KES</span>
                    <span className="text-base font-bold leading-none">{item.price}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.validity}</p>
                    {item.note ? (
                      <p className="mt-0.5 text-[11px] text-accent">{item.note}</p>
                    ) : null}
                  </div>
                  <Button size="sm" onClick={() => openDeal(item)}>
                    Buy
                  </Button>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <footer className="mt-10 text-center text-xs text-muted-foreground">
        Need dealer access?{" "}
        <a className="text-primary underline" href="/admin">
          Open admin
        </a>
      </footer>

      <a
        href={telHref}
        aria-label={`Call support on ${supportPhone}`}
        className="gradient-primary fixed bottom-5 right-5 flex size-14 items-center justify-center rounded-full text-2xl text-primary-foreground shadow-lg"
      >
        📞
      </a>

      <Dialog open={!!deal} onOpenChange={(open) => !open && !busy && setDeal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Buy {deal?.title} · KES {deal?.price}
            </DialogTitle>
            <DialogDescription>{deal?.validity} · M-Pesa prompt</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {(["mine", "other"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    if (item === "other") {
                      toast.info("Buying for another number is coming soon.");
                      return;
                    }
                    setMode(item);
                  }}
                  className={`rounded-xl border p-3 text-sm font-medium transition-colors ${
                    mode === item
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {item === "mine" ? "My number" : "Other number"}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-number">Your M-Pesa number</Label>
              <Input
                id="payment-number"
                inputMode="tel"
                placeholder="07XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
              />
            </div>
            {statusText ? <p className="text-xs text-muted-foreground">{statusText}</p> : null}
          </div>
          <DialogFooter>
            <Button className="w-full" size="lg" disabled={busy} onClick={buy}>
              {busy ? "Processing…" : `Buy now · KES ${deal?.price ?? ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
