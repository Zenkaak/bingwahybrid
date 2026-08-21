import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";

type Dashboard = {
  salesCount: number;
  balance: number;
  revenue: number;
  totalCommissions: number;
  withdrawableCommissions: number;
  pendingCommissions: number;
  sales: Array<{
    id: string;
    offerTitle: string;
    amount: number;
    paymentPhone: string;
    receivingPhone: string;
    commission: number;
    createdAt: string;
  }>;
  customers: Array<{ phone: string; salesCount: number; totalSpend: number; lastSeen: string }>;
};

type Settings = { enabled: boolean; till: string };
const ADMIN_TOKEN_KEY = "bingwa_admin_token";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Bingwa Sokoni Admin" },
      { name: "description", content: "Dealer dashboard for Bingwa Sokoni sales and commissions." },
      { property: "og:title", content: "Bingwa Sokoni Admin" },
      {
        property: "og:description",
        content: "Dealer dashboard for Bingwa Sokoni sales and commissions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

async function jsonRequest(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("authorization")) {
    const token =
      typeof window === "undefined" ? null : window.localStorage.getItem(ADMIN_TOKEN_KEY);
    if (token) headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    token?: string;
    error?: string;
    data?: unknown;
    authenticated?: boolean;
  };
  if (response.status === 401 && typeof window !== "undefined") {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
  if (!response.ok) {
    const error = new Error(body.error ?? "Request failed.");
    Object.assign(error, { status: response.status });
    throw error;
  }
  return body;
}

function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [settings, setSettings] = useState<Settings>({ enabled: false, till: "3367738" });
  const [saving, setSaving] = useState(false);
  const [floatAmount, setFloatAmount] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadDashboard() {
    const [dashboardResult, settingsResult] = await Promise.allSettled([
      jsonRequest("/api/admin/dashboard"),
      jsonRequest("/api/admin/settings"),
    ]);

    if (dashboardResult.status === "rejected") throw dashboardResult.reason;
    setDashboard(dashboardResult.value.data as Dashboard);

    if (settingsResult.status === "fulfilled") {
      setSettings(settingsResult.value.data as Settings);
    } else {
      toast.warning("Gateway settings could not load. The dashboard is still available.");
    }
  }

  async function load() {
    setLoadError(null);
    try {
      const me = await jsonRequest("/api/admin/me");
      if (!me.authenticated) {
        setAuthenticated(false);
        setDashboard(null);
        return;
      }
      setAuthenticated(true);
      await loadDashboard();
    } catch (error) {
      const status = error instanceof Error && "status" in error ? Number(error.status) : 0;
      if (status === 401) {
        setAuthenticated(false);
        setDashboard(null);
        return;
      }
      setLoadError(error instanceof Error ? error.message : "Could not load the dashboard.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await jsonRequest("/api/admin/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (typeof response.token !== "string" || !response.token) {
        throw new Error("Login did not return a valid session.");
      }
      window.localStorage.setItem(ADMIN_TOKEN_KEY, response.token);
      setAuthenticated(true);
      setPin("");
      toast.success("Admin dashboard unlocked.");
      await loadDashboard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not unlock dashboard.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings(next: Settings) {
    setSaving(true);
    try {
      const response = await jsonRequest("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      setSettings(response.data as Settings);
      toast.success("Gateway settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (authenticated === null)
    return <main className="flex min-h-screen items-center justify-center">Loading…</main>;
  if (!authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <Toaster />
        <form className="surface-card w-full max-w-sm rounded-3xl p-7" onSubmit={login}>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Bingwa Sokoni
          </p>
          <h1 className="mt-3 text-2xl font-bold">Admin dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Products stay public. Float, sales, commissions and customers stay here.
          </p>
          <div className="mt-6 space-y-2">
            <Label htmlFor="admin-pin">Dealer PIN</Label>
            <Input
              id="admin-pin"
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Button className="mt-5 w-full" disabled={saving}>
            Unlock dashboard
          </Button>
          <a href="/" className="mt-4 block text-center text-sm text-muted-foreground underline">
            Back to products
          </a>
        </form>
      </main>
    );
  }

  if (loadError)
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="surface-card w-full max-w-lg rounded-3xl p-7 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-destructive">Dashboard unavailable</p>
          <h1 className="mt-3 text-2xl font-bold">Could not load your dashboard</h1>
          <p className="mt-3 text-sm text-muted-foreground">{loadError}</p>
          <p className="mt-2 text-sm text-muted-foreground">Check the production Supabase server credentials and that the app settings row exists, then try again.</p>
          <Button className="mt-6" onClick={() => void load()}>Try again</Button>
        </div>
      </main>
    );
  if (!dashboard)
    return (
      <main className="flex min-h-screen items-center justify-center">Loading dashboard…</main>
    );
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-16">
      <Toaster />
      <header className="flex flex-wrap items-end justify-between gap-4 pt-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Private workspace
          </p>
          <h1 className="mt-2 text-3xl font-bold">Admin dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track sales, commissions and customers in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                await jsonRequest("/api/admin/auth", { method: "DELETE" });
              } finally {
                window.localStorage.removeItem(ADMIN_TOKEN_KEY);
                window.location.href = "/";
              }
            }}
          >
            Log out
          </Button>
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          ["Float balance", `KES ${dashboard.balance.toLocaleString()}`],
          ["Sales", dashboard.salesCount.toLocaleString()],
          ["Revenue", `KES ${dashboard.revenue.toLocaleString()}`],
          ["Commission", `KES ${dashboard.totalCommissions.toLocaleString()}`],
          ["Withdrawable", `KES ${dashboard.withdrawableCommissions.toLocaleString()}`],
        ].map(([label, value]) => (
          <div key={label} className="surface-card rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <section className="surface-card mt-6 rounded-2xl p-5">
        <h2 className="font-bold">Add float</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep dealer float tracking in the private dashboard.
        </p>
        <div className="mt-4 flex max-w-sm gap-2">
          <Input
            inputMode="numeric"
            placeholder="Amount in KES"
            value={floatAmount}
            onChange={(e) => setFloatAmount(e.target.value.replace(/\D/g, ""))}
          />
          <Button
            disabled={saving || !Number(floatAmount)}
            onClick={async () => {
              setSaving(true);
              try {
                await jsonRequest("/api/admin/float", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ amount: Number(floatAmount) }),
                });
                setFloatAmount("");
                await load();
                toast.success("Float balance updated.");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not add float.");
              } finally {
                setSaving(false);
              }
            }}
          >
            Add float
          </Button>
        </div>
      </section>

      <section className="surface-card mt-6 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-bold">Prompt gateway</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              When enabled, prompts use the editable till below. When disabled, money stays on the
              configured Paybill.
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            disabled={saving}
            onCheckedChange={(enabled) => void saveSettings({ ...settings, enabled })}
          />
        </div>
        <div className="mt-4 max-w-sm space-y-2">
          <Label htmlFor="gateway-till">Gateway till</Label>
          <div className="flex gap-2">
            <Input
              id="gateway-till"
              inputMode="numeric"
              value={settings.till}
              onChange={(e) =>
                setSettings({ ...settings, till: e.target.value.replace(/\D/g, "") })
              }
            />
            <Button disabled={saving} onClick={() => void saveSettings(settings)}>
              Save
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Commission wallet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                15% commission: KES 10 earns KES 1.50. Each KES 10 block becomes withdrawable
                automatically.
              </p>
            </div>
            <Button
              disabled={dashboard.withdrawableCommissions < 10 || saving}
              onClick={async () => {
                try {
                  await jsonRequest("/api/admin/withdraw", { method: "POST" });
                  toast.success("Withdrawal marked as requested.");
                  await load();
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Could not request withdrawal.",
                  );
                }
              }}
            >
              Withdraw
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Ready</p>
              <p className="mt-1 font-bold">
                KES {dashboard.withdrawableCommissions.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="mt-1 font-bold">KES {dashboard.pendingCommissions.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="surface-card rounded-2xl p-5">
          <h2 className="font-bold">Customers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {dashboard.customers.length} saved customer numbers
          </p>
          <div className="mt-4 space-y-3">
            {dashboard.customers.slice(0, 5).map((customer) => (
              <div key={customer.phone} className="flex justify-between gap-3 text-sm">
                <span>{customer.phone}</span>
                <span className="text-muted-foreground">
                  {customer.salesCount} sales · KES {customer.totalSpend}
                </span>
              </div>
            ))}
            {!dashboard.customers.length ? (
              <p className="text-sm text-muted-foreground">
                Customers will appear after the first confirmed purchase.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="surface-card mt-6 rounded-2xl p-5">
        <h2 className="font-bold">Recent sales</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="pb-3">Offer</th>
                <th className="pb-3">Payment</th>
                <th className="pb-3">Receiving</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Commission</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.sales.map((sale) => (
                <tr key={sale.id} className="border-b border-border/60">
                  <td className="py-3">{sale.offerTitle}</td>
                  <td className="py-3">{sale.paymentPhone}</td>
                  <td className="py-3">{sale.receivingPhone}</td>
                  <td className="py-3">KES {sale.amount}</td>
                  <td className="py-3">KES {sale.commission}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!dashboard.sales.length ? (
            <p className="py-6 text-sm text-muted-foreground">No confirmed sales yet.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
