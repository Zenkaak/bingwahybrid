import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  ACTIVATION_FEE,
  DEFAULT_PIN,
  OFFER_GROUPS,
  START_BALANCE,
  TILL_NAME,
  TILL_NUMBER,
  type Offer,
} from "@/lib/packages";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bingwa Sokoni — Data, SMS & Minutes Offers" },
      {
        name: "description",
        content:
          "Buy Bingwa Sokoni data, SMS, minutes and Tunukiwa offers instantly. Till 4211224 — MARTHA WAMBUI.",
      },
      { property: "og:title", content: "Bingwa Sokoni — Data, SMS & Minutes Offers" },
      {
        property: "og:description",
        content:
          "Automated Bingwa Sokoni offers: data from Ksh.19, SMS from Ksh.5 and minutes from Ksh.22.",
      },
    ],
  }),
  component: BingwaApp,
});

function BingwaApp() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [active, setActive] = useState(false);
  const [balance, setBalance] = useState(START_BALANCE);
  const [salesCount, setSalesCount] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [showFloat, setShowFloat] = useState(false);
  const [floatAmount, setFloatAmount] = useState("");
  const [floatPhone, setFloatPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [sellOffer, setSellOffer] = useState<Offer | null>(null);
  const [customer, setCustomer] = useState("");
  const [method, setMethod] = useState<"airtime" | "mpesa">("mpesa");
  const [showActivation, setShowActivation] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [left, setLeft] = useState("60:00");


  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const ms = Math.max(0, deadline - Date.now());
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLeft(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  if (!unlocked) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <Toaster />
        <div className="surface-card w-full max-w-sm rounded-3xl p-7 text-center">
          <div className="gradient-primary shadow-elevated mx-auto flex size-16 items-center justify-center rounded-2xl text-2xl font-bold text-primary-foreground">
            BS
          </div>
          <h1 className="mt-5 text-2xl font-bold">Bingwa Sokoni</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your dealer PIN to open the dashboard
          </p>
          <form
            className="mt-6 space-y-4 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              if (pin === DEFAULT_PIN) {
                setUnlocked(true);
                toast.success("Welcome back, dealer");
              } else {
                toast.error("Wrong PIN. Try again.");
                setPin("");
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="pin">Dealer PIN</Label>
              <Input
                id="pin"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="h-12 text-center text-xl tracking-[0.6em]"
              />
            </div>
            <Button type="submit" size="lg" className="w-full">
              Unlock dashboard
            </Button>
          </form>
          <p className="mt-5 text-xs text-muted-foreground">
            Till {TILL_NUMBER} · {TILL_NAME}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-16">
      <Toaster />
      <header className="pt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
          Automated offers
        </p>
        <h1 className="mt-2 text-3xl font-bold">Bingwa Sokoni</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Till {TILL_NUMBER} · {TILL_NAME}
        </p>
      </header>

      <section className="surface-card shadow-elevated mt-6 overflow-hidden rounded-3xl">
        <div className="flex items-start justify-between gap-4 p-6 pb-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Float balance
            </p>
            <p className="mt-1 font-display text-4xl font-bold">
              KES {balance.toLocaleString()}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={active ? "default" : "secondary"}>
                {active ? "Account active" : "Not activated"}
              </Badge>
              {deadline && !active ? (
                <span className="text-xs text-accent">Activate within {left}</span>
              ) : null}
            </div>
          </div>
          <div className="grid w-[9.5rem] shrink-0 gap-2">
            <Button
              size="sm"
              className="w-full"
              disabled={active}
              onClick={() => {
                setDeadline(Date.now() + 60 * 60 * 1000);
                setShowActivation(true);
              }}
            >
              {active ? "Activated" : "Activate app"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                setFloatAmount("");
                setShowFloat(true);
              }}
            >
              Add float
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border border-t border-border bg-background/30 text-center">
          <div className="p-3">
            <p className="text-sm font-semibold">{salesCount}</p>
            <p className="text-[11px] text-muted-foreground">Sales today</p>
          </div>
          <div className="p-3">
            <p className="text-sm font-semibold">KES {revenue.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">Revenue</p>
          </div>
          <div className="p-3">
            <p className="text-sm font-semibold">{TILL_NUMBER}</p>
            <p className="text-[11px] text-muted-foreground">Till</p>
          </div>
        </div>
      </section>


      <p className="mt-6 rounded-2xl border border-border bg-card/60 p-4 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Please note:</strong> 1GB hourly data (Ksh.23 &amp;
        Ksh.19) is only available daily from 11:00pm to 4:00pm. If you buy 1GB after 4pm you will
        get 250MB + free WhatsApp.
      </p>

      {OFFER_GROUPS.map((group) => (
        <section key={group.id} className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold">
              <span className="mr-2">{group.icon}</span>
              {group.name}
            </h2>
            <span className="text-[11px] text-muted-foreground">{group.tagline}</span>
          </div>
          <div className="mt-3 space-y-3">
            {group.offers.map((offer) => (
              <article
                key={offer.id}
                className="surface-card flex items-center gap-4 rounded-2xl p-4"
              >
                <div className="gradient-primary flex size-14 shrink-0 flex-col items-center justify-center rounded-xl text-primary-foreground">
                  <span className="text-[10px] font-semibold opacity-80">KSH</span>
                  <span className="text-base font-bold leading-none">{offer.price}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{offer.title}</p>
                  <p className="text-xs text-muted-foreground">{offer.validity}</p>
                  {offer.note ? (
                    <p className="mt-0.5 text-[11px] text-accent">{offer.note}</p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setSellOffer(offer);
                    setCustomer("");
                  }}
                >
                  Sell
                </Button>
              </article>
            ))}
          </div>
        </section>
      ))}

      <footer className="mt-10 text-center text-xs text-muted-foreground">
        Till name <strong className="text-foreground">{TILL_NAME}</strong> · Till number{" "}
        <strong className="text-foreground">{TILL_NUMBER}</strong>
      </footer>

      <Dialog open={!!sellOffer} onOpenChange={(o) => !o && setSellOffer(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Sell {sellOffer?.title} · Ksh.{sellOffer?.price}
            </DialogTitle>
            <DialogDescription>{sellOffer?.validity}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer number</Label>
              <Input
                id="customer"
                inputMode="tel"
                placeholder="07XX XXX XXX"
                value={customer}
                onChange={(e) => setCustomer(e.target.value.replace(/[^\d+]/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label>Pay with</Label>
              <div className="grid grid-cols-2 gap-3">
                {(["airtime", "mpesa"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`rounded-xl border p-3 text-sm font-medium capitalize transition-colors ${
                      method === m
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {m === "mpesa" ? "M-Pesa" : "Airtime"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              disabled={busy}
              onClick={async () => {
                if (customer.replace(/\D/g, "").length < 9) {
                  toast.error("Enter a valid customer number");
                  return;
                }
                if (!active) {
                  setSellOffer(null);
                  setDeadline(Date.now() + 60 * 60 * 1000);
                  setShowActivation(true);
                  toast.error("Your app is not active");
                  return;
                }
                const offer = sellOffer!;
                if (method === "airtime" && balance < offer.price) {
                  toast.error("Not enough float. Add float to continue.");
                  return;
                }
                setBusy(true);
                try {
                  if (method === "mpesa") {
                    const res = await push({
                      data: {
                        phone: customer,
                        amount: offer.price,
                        reference: TILL_NUMBER,
                        description: `${offer.title} ${offer.validity}`,
                      },
                    });
                    if (!res.ok) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success(`STK push sent to ${customer}`);
                  } else {
                    setBalance((b) => b - offer.price);
                    toast.success(`${offer.title} sent to ${customer} from float`);
                  }
                  setSalesCount((n) => n + 1);
                  setRevenue((r) => r + offer.price);
                  setSellOffer(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Processing…" : "Confirm sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFloat} onOpenChange={setShowFloat}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add float</DialogTitle>
            <DialogDescription>
              We'll send an M-Pesa prompt to your phone. Payment goes to Till {TILL_NUMBER}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="float-phone">Your M-Pesa number</Label>
              <Input
                id="float-phone"
                inputMode="tel"
                placeholder="07XX XXX XXX"
                value={floatPhone}
                onChange={(e) => setFloatPhone(e.target.value.replace(/[^\d+]/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="float-amount">Amount (KES)</Label>
              <Input
                id="float-amount"
                inputMode="numeric"
                placeholder="1000"
                value={floatAmount}
                onChange={(e) => setFloatAmount(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="flex gap-2">
              {[500, 1000, 5000].map((a) => (
                <Button
                  key={a}
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setFloatAmount(String(a))}
                >
                  {a.toLocaleString()}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              size="lg"
              disabled={busy}
              onClick={async () => {
                const amount = Number(floatAmount);
                if (floatPhone.replace(/\D/g, "").length < 9 || !amount) {
                  toast.error("Enter your number and an amount");
                  return;
                }
                setBusy(true);
                try {
                  const res = await push({
                    data: {
                      phone: floatPhone,
                      amount,
                      reference: TILL_NUMBER,
                      description: "Float top-up",
                    },
                  });
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Enter your M-Pesa PIN to complete the top-up");
                  setShowFloat(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Sending prompt…" : "Send M-Pesa prompt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showActivation} onOpenChange={setShowActivation}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>Your app is not active</DialogTitle>
            <DialogDescription>
              Activate your dealer account with a one-off fee of Ksh.{ACTIVATION_FEE}. Activation
              must be completed within 1 hour or your float will be reversed.
            </DialogDescription>
          </DialogHeader>
          <div className="surface-card rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">Time remaining</p>
            <p className="font-display text-3xl font-bold text-accent">{left}</p>
          </div>
          <div className="space-y-2 text-left">
            <Label htmlFor="act-phone">Your M-Pesa number</Label>
            <Input
              id="act-phone"
              inputMode="tel"
              placeholder="07XX XXX XXX"
              value={floatPhone}
              onChange={(e) => setFloatPhone(e.target.value.replace(/[^\d+]/g, ""))}
            />
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              size="lg"
              disabled={busy}
              onClick={async () => {
                if (floatPhone.replace(/\D/g, "").length < 9) {
                  toast.error("Enter your M-Pesa number");
                  return;
                }
                setBusy(true);
                try {
                  const res = await push({
                    data: {
                      phone: floatPhone,
                      amount: ACTIVATION_FEE,
                      reference: TILL_NUMBER,
                      description: "App activation",
                    },
                  });
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  setActive(true);
                  setShowActivation(false);
                  toast.success("Activation prompt sent. Enter your M-Pesa PIN.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Sending prompt…" : `Activate now · Ksh.${ACTIVATION_FEE}`}
            </Button>
          </DialogFooter>
          <p className="text-[11px] text-muted-foreground">
            Payment goes to Till {TILL_NUMBER} · {TILL_NAME}
          </p>
        </DialogContent>
      </Dialog>

    </main>
  );
}
