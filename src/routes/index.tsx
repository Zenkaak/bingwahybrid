import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { OFFER_GROUPS, type Offer } from "@/lib/packages";

const PAYMENT_POLL_ATTEMPTS = 10;
const PAYMENT_POLL_DELAY_MS = 3000;

type PaymentResult = { ok: true; checkoutRequestId: string | null } | { ok: false; error: string };

async function requestPayment(
  action: "stkPush" | "stkQuery",
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await fetch("/api/public/mpesa", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, data }),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(body["error"] ?? "Payment service rejected the request."));
  return body;
}

async function waitForPayment(checkoutRequestId: string | null) {
  if (!checkoutRequestId)
    return { status: "pending" as const, message: "Prompt sent. Awaiting confirmation." };
  for (let attempt = 0; attempt < PAYMENT_POLL_ATTEMPTS; attempt += 1) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, PAYMENT_POLL_DELAY_MS));
    const result = await requestPayment("stkQuery", { checkoutRequestId });
    if (result["ok"] !== true)
      return { status: "failed" as const, message: String(result["error"] ?? "Payment failed.") };
    if (result["status"] !== "pending")
      return result as { status: "success" | "failed"; message: string };
  }
  return {
    status: "pending" as const,
    message: "Prompt sent, but confirmation is taking longer than expected.",
  };
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bingwa Sokoni — Buy Data, SMS & Minutes" },
      { name: "description", content: "Buy Bingwa Sokoni data, SMS, minutes and Tunukiwa offers." },
      { property: "og:title", content: "Bingwa Sokoni — Buy Data, SMS & Minutes" },
      {
        property: "og:description",
        content: "Buy data, SMS, minutes and Tunukiwa offers instantly.",
      },
    ],
  }),
  component: Storefront,
});

function Storefront() {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [mode, setMode] = useState<"mine" | "other">("mine");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [receivingPhone, setReceivingPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function openOffer(nextOffer: Offer) {
    setOffer(nextOffer);
    setMode("mine");
    setPaymentPhone("");
    setReceivingPhone("");
  }

  async function buy() {
    if (!offer) return;
    const payer = paymentPhone.replace(/\D/g, "");
    const recipient = (mode === "mine" ? paymentPhone : receivingPhone).replace(/\D/g, "");
    if (payer.length < 9 || recipient.length < 9) {
      toast.error(
        mode === "mine" ? "Enter your M-Pesa number." : "Enter both payment and receiving numbers.",
      );
      return;
    }
    setBusy(true);
    try {
      const prompt = (await requestPayment("stkPush", {
        phone: paymentPhone,
        amount: offer.price,
        reference: offer.service,
        description: `${offer.title} ${offer.validity}`,
      })) as PaymentResult;
      if (!prompt.ok) throw new Error(prompt.error);
      const payment = await waitForPayment(prompt.checkoutRequestId);
      if (payment.status === "failed") throw new Error(payment.message);
      if (payment.status === "pending") {
        toast.info(payment.message);
        return;
      }
      const saved = await fetch("/api/public/sales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          offerId: offer.id,
          paymentPhone: payer,
          receivingPhone: recipient,
          paymentMode: "mpesa",
        }),
      });
      const savedBody = (await saved.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!saved.ok || !savedBody.ok)
        throw new Error(savedBody.error ?? "Could not save the purchase.");
      toast.success(`${offer.title} is being sent to ${recipient}.`);
      setOffer(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete the purchase.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-16">
      <Toaster />
      <header className="pt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              Bingwa Sokoni
            </p>
            <h1 className="mt-2 text-3xl font-bold">Buy bundles quickly</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose an offer, pay with M-Pesa, and send it to your number or someone else.
            </p>
          </div>
          {installPrompt ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await installPrompt.prompt();
                await installPrompt.userChoice;
                setInstallPrompt(null);
              }}
            >
              Install
            </Button>
          ) : null}
        </div>
      </header>

      <div className="mt-6 rounded-2xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
        <Badge>Secure prompt</Badge>
        <p className="mt-2">Your payment is verified before the bundle is recorded for delivery.</p>
      </div>

      {OFFER_GROUPS.map((group) => (
        <section key={group.id} className="mt-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold">
              <span className="mr-2">{group.icon}</span>
              {group.name}
            </h2>
            <span className="text-[11px] text-muted-foreground">{group.tagline}</span>
          </div>
          <div className="mt-3 space-y-3">
            {group.offers.map((item) => (
              <article
                key={item.id}
                className="surface-card flex items-center gap-4 rounded-2xl p-4"
              >
                <div className="gradient-primary flex size-14 shrink-0 flex-col items-center justify-center rounded-xl text-primary-foreground">
                  <span className="text-[10px] font-semibold opacity-80">KSH</span>
                  <span className="text-base font-bold leading-none">{item.price}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.validity}</p>
                  {item.note ? <p className="mt-0.5 text-[11px] text-accent">{item.note}</p> : null}
                </div>
                <Button size="sm" onClick={() => openOffer(item)}>
                  Buy
                </Button>
              </article>
            ))}
          </div>
        </section>
      ))}

      <footer className="mt-10 text-center text-xs text-muted-foreground">
        Need dealer access?{" "}
        <a className="text-primary underline" href="/admin">
          Open admin
        </a>
      </footer>

      <Dialog open={!!offer} onOpenChange={(open) => !open && setOffer(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Buy {offer?.title} · KES {offer?.price}
            </DialogTitle>
            <DialogDescription>{offer?.validity} · M-Pesa prompt</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {(["mine", "other"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
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
              <Label htmlFor="payment-number">
                {mode === "mine" ? "Your M-Pesa number" : "Payment number"}
              </Label>
              <Input
                id="payment-number"
                inputMode="tel"
                placeholder="07XX XXX XXX"
                value={paymentPhone}
                onChange={(e) => setPaymentPhone(e.target.value.replace(/[^\d+]/g, ""))}
              />
            </div>
            {mode === "other" ? (
              <div className="space-y-2">
                <Label htmlFor="receiving-number">Receiving number</Label>
                <Input
                  id="receiving-number"
                  inputMode="tel"
                  placeholder="07XX XXX XXX"
                  value={receivingPhone}
                  onChange={(e) => setReceivingPhone(e.target.value.replace(/[^\d+]/g, ""))}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button className="w-full" size="lg" disabled={busy} onClick={buy}>
              {busy ? "Processing…" : `Buy now · KES ${offer?.price ?? ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
