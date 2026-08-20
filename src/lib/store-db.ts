type GatewaySettings = {
  enabled: boolean;
  till: string;
};

type DashboardData = {
  balance: number;
  salesCount: number;
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
    status: string;
    commission: number;
    createdAt: string;
  }>;
  customers: Array<{
    phone: string;
    salesCount: number;
    totalSpend: number;
    lastSeen: string;
  }>;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadSettings() {
  const db = await admin();
  const { data, error } = await db.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) throw new Error("Settings are not available right now.");
  return data;
}

export async function getAdminPin() {
  const settings = await loadSettings().catch(() => null);
  return settings?.admin_pin ?? "9898";
}

export async function getGatewaySettings(): Promise<GatewaySettings> {
  const settings = await loadSettings();
  return {
    enabled: settings.gateway_enabled,
    till: /^\d{5,10}$/.test(settings.till_number) ? settings.till_number : "3367738",
  };
}

export async function updateGatewaySettings(settings: GatewaySettings) {
  const db = await admin();
  const { error } = await db
    .from("app_settings")
    .update({
      gateway_enabled: settings.enabled,
      till_number: settings.till,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) throw new Error("Could not save settings.");
  return settings;
}

export async function addFloat(amount: number) {
  const db = await admin();
  const settings = await loadSettings();
  const balance = Number(settings.float_balance) + amount;
  const { error } = await db
    .from("app_settings")
    .update({ float_balance: balance, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error("Could not add float.");
  return balance;
}

export async function recordConfirmedSale(input: {
  offerId: string;
  offerTitle: string;
  service: string;
  amount: number;
  paymentPhone: string;
  receivingPhone: string;
  paymentMode: "mpesa" | "float";
}) {
  const db = await admin();
  const settings = await loadSettings();
  const commission = (input.amount / 10) * Number(settings.commission_per_ten);
  const destination = settings.gateway_enabled ? settings.till_number : settings.paybill_number;

  const { data: sale, error } = await db
    .from("sales")
    .insert({
      offer_id: input.offerId,
      offer_title: input.offerTitle,
      service: input.service,
      price: input.amount,
      commission,
      payment_phone: input.paymentPhone,
      receiving_phone: input.receivingPhone,
      for_self: input.paymentPhone === input.receivingPhone,
      gateway_enabled: settings.gateway_enabled,
      destination,
      status: "paid",
    })
    .select("id")
    .single();
  if (error) throw new Error("Could not save the sale.");

  const { data: customer } = await db
    .from("customers")
    .select("purchases, total_spent")
    .eq("phone", input.receivingPhone)
    .maybeSingle();

  if (customer) {
    await db
      .from("customers")
      .update({
        purchases: (customer.purchases ?? 0) + 1,
        total_spent: Number(customer.total_spent ?? 0) + input.amount,
        last_seen_at: new Date().toISOString(),
      })
      .eq("phone", input.receivingPhone);
  } else {
    await db.from("customers").insert({
      phone: input.receivingPhone,
      purchases: 1,
      total_spent: input.amount,
    });
  }

  return { id: sale?.id ?? null, commission };
}

export async function getDashboardData(): Promise<DashboardData> {
  const db = await admin();
  const settings = await loadSettings();
  const [{ data: sales }, { data: customers }, { data: withdrawals }] = await Promise.all([
    db.from("sales").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("customers").select("*").order("last_seen_at", { ascending: false }).limit(100),
    db.from("withdrawals").select("*").limit(200),
  ]);

  const paid = (sales ?? []).filter((sale) => sale.status === "paid");
  const earned = paid.reduce((sum, sale) => sum + Number(sale.commission), 0);
  const withdrawn = (withdrawals ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const available = Math.max(0, earned - withdrawn);
  const threshold = Number(settings.withdraw_threshold) || 10;
  const withdrawable = Math.floor(available / threshold) * threshold;

  return {
    balance: Number(settings.float_balance),
    salesCount: paid.length,
    revenue: paid.reduce((sum, sale) => sum + Number(sale.price), 0),
    totalCommissions: Number(earned.toFixed(2)),
    withdrawableCommissions: Number(withdrawable.toFixed(2)),
    pendingCommissions: Number((available - withdrawable).toFixed(2)),
    sales: (sales ?? []).map((sale) => ({
      id: String(sale.id),
      offerTitle: sale.offer_title,
      amount: Number(sale.price),
      paymentPhone: sale.payment_phone,
      receivingPhone: sale.receiving_phone,
      status: sale.status,
      commission: Number(sale.commission),
      createdAt: sale.created_at,
    })),
    customers: (customers ?? []).map((customer) => ({
      phone: customer.phone,
      salesCount: customer.purchases,
      totalSpend: Number(customer.total_spent),
      lastSeen: customer.last_seen_at,
    })),
  };
}

export async function requestCommissionWithdrawal(phone?: string | null) {
  const db = await admin();
  const dashboard = await getDashboardData();
  const amount = dashboard.withdrawableCommissions;
  if (!amount) return { amount: 0 };
  const { error } = await db
    .from("withdrawals")
    .insert({ amount, phone: phone ?? null, status: "requested" });
  if (error) throw new Error("Could not request the withdrawal.");
  return { amount };
}
