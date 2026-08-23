export type GatewaySettings = { enabled: boolean; till: string };

export type Deal = {
  id: string;
  groupKey: string;
  title: string;
  price: number;
  validity: string;
  note: string | null;
  sortOrder: number;
  active: boolean;
};

export type Order = {
  id: string;
  offerId: string;
  offerTitle: string;
  service: string;
  amount: number;
  commission: number;
  paymentPhone: string;
  receivingPhone: string;
  status: "pending" | "paid" | "failed";
  receipt: string | null;
  resultDesc: string | null;
  destination: string;
  createdAt: string;
};

export type DashboardData = {
  balance: number;
  businessName: string;
  supportPhone: string;
  salesCount: number;
  revenue: number;
  revenueToday: number;
  salesToday: number;
  pendingCount: number;
  failedCount: number;
  totalCommissions: number;
  withdrawableCommissions: number;
  pendingCommissions: number;
  orders: Order[];
  customers: Array<{ phone: string; salesCount: number; totalSpend: number; lastSeen: string }>;
  withdrawals: Array<{ id: string; amount: number; phone: string | null; createdAt: string }>;
  topDeals: Array<{ title: string; count: number; revenue: number }>;
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadSettings() {
  const client = await db();
  const { data, error } = await client.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) throw new Error("Settings are not available right now.");
  return data as Record<string, unknown>;
}

export async function getAdminPin() {
  try {
    const settings = await loadSettings();
    return (settings["admin_pin"] as string) || "9898";
  } catch {
    return "9898";
  }
}

export async function getGatewaySettings(): Promise<GatewaySettings> {
  const settings = await loadSettings();
  const till = String(settings["till_number"] ?? "");
  return {
    enabled: settings["gateway_enabled"] === true,
    till: /^\d{5,10}$/.test(till) ? till : "3367738",
  };
}

export async function getStoreSettings() {
  const settings = await loadSettings();
  return {
    enabled: settings["gateway_enabled"] === true,
    till: String(settings["till_number"] ?? "3367738"),
    paybill: String(settings["paybill_number"] ?? "4211224"),
    businessName: String(settings["business_name"] ?? "BLACK HOLE BINGWA SERVICES"),
    supportPhone: String(settings["support_phone"] ?? "0769252572"),
    commissionPerTen: Number(settings["commission_per_ten"] ?? 1.5),
    withdrawThreshold: Number(settings["withdraw_threshold"] ?? 10),
    floatBalance: Number(settings["float_balance"] ?? 0),
  };
}

export async function updateStoreSettings(patch: {
  enabled?: boolean;
  till?: string;
  paybill?: string;
  businessName?: string;
  supportPhone?: string;
  adminPin?: string;
}) {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.enabled === "boolean") update["gateway_enabled"] = patch.enabled;
  if (patch.till) update["till_number"] = patch.till;
  if (patch.paybill) update["paybill_number"] = patch.paybill;
  if (patch.businessName) update["business_name"] = patch.businessName;
  if (patch.supportPhone) update["support_phone"] = patch.supportPhone;
  if (patch.adminPin && /^\d{4,6}$/.test(patch.adminPin)) update["admin_pin"] = patch.adminPin;

  const client = await db();
  const { error } = await client.from("app_settings").update(update).eq("id", 1);
  if (error) throw new Error("Could not save settings.");
  return getStoreSettings();
}

export async function updateGatewaySettings(settings: GatewaySettings) {
  await updateStoreSettings({ enabled: settings.enabled, till: settings.till });
  return settings;
}

export async function addFloat(amount: number) {
  const settings = await getStoreSettings();
  const balance = settings.floatBalance + amount;
  const client = await db();
  const { error } = await client
    .from("app_settings")
    .update({ float_balance: balance, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error("Could not add float.");
  return balance;
}

function mapDeal(row: Record<string, unknown>): Deal {
  return {
    id: String(row["id"]),
    groupKey: String(row["group_key"]),
    title: String(row["title"]),
    price: Number(row["price"]),
    validity: String(row["validity"]),
    note: (row["note"] as string | null) ?? null,
    sortOrder: Number(row["sort_order"] ?? 0),
    active: row["active"] !== false,
  };
}

export async function listDeals(options?: { activeOnly?: boolean }) {
  const client = await db();
  let request = client.from("deals").select("*");
  if (options?.activeOnly) request = request.eq("active", true);
  const { data, error } = await request
    .order("group_key", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error("Could not load deals.");
  return (data ?? []).map((row) => mapDeal(row as Record<string, unknown>));
}

export async function saveDeal(input: Deal) {
  const client = await db();
  const { error } = await client.from("deals").upsert({
    id: input.id,
    group_key: input.groupKey,
    title: input.title,
    price: input.price,
    validity: input.validity,
    note: input.note,
    sort_order: input.sortOrder,
    active: input.active,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("Could not save the deal.");
  return listDeals();
}

export async function deleteDeal(id: string) {
  const client = await db();
  const { error } = await client.from("deals").delete().eq("id", id);
  if (error) throw new Error("Could not delete the deal.");
  return listDeals();
}

export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

export async function createPendingSale(input: {
  deal: Deal;
  paymentPhone: string;
  receivingPhone: string;
  checkoutRequestId: string | null;
}) {
  const settings = await getStoreSettings();
  const client = await db();
  const commission = (input.deal.price / 10) * settings.commissionPerTen;
  const destination = settings.enabled ? settings.till : settings.paybill;
  const paymentPhone = normalizePhone(input.paymentPhone);
  const receivingPhone = normalizePhone(input.receivingPhone);

  await client
    .from("customers")
    .upsert({ phone: receivingPhone, last_seen_at: new Date().toISOString() }, { onConflict: "phone" });

  const { data, error } = await client
    .from("sales")
    .insert({
      offer_id: input.deal.id,
      offer_title: `${input.deal.title} · ${input.deal.validity}`,
      service: input.deal.groupKey,
      price: input.deal.price,
      commission,
      payment_phone: paymentPhone,
      receiving_phone: receivingPhone,
      for_self: paymentPhone === receivingPhone,
      gateway_enabled: settings.enabled,
      destination,
      status: "pending",
      checkout_request_id: input.checkoutRequestId,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("Could not record the order.");
  return { id: String((data as { id: string }).id), commission, destination };
}

export async function markSaleResult(input: {
  saleId?: string | null;
  checkoutRequestId?: string | null;
  status: "paid" | "failed";
  receipt?: string | null;
  resultDesc?: string | null;
}) {
  const client = await db();
  let query = client.from("sales").select("*").limit(1);
  query = input.saleId
    ? query.eq("id", input.saleId)
    : query.eq("checkout_request_id", input.checkoutRequestId ?? "");
  const { data } = await query.maybeSingle();
  const sale = data as Record<string, unknown> | null;
  if (!sale) return null;

  const alreadyPaid = sale["status"] === "paid";
  await client
    .from("sales")
    .update({
      status: input.status,
      mpesa_receipt: input.receipt ?? (sale["mpesa_receipt"] as string | null),
      result_desc: input.resultDesc ?? (sale["result_desc"] as string | null),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sale["id"] as string);

  if (input.status === "paid" && !alreadyPaid) {
    const phone = String(sale["receiving_phone"]);
    const { data: customer } = await client
      .from("customers")
      .select("purchases, total_spent")
      .eq("phone", phone)
      .maybeSingle();
    const row = customer as { purchases?: number; total_spent?: number } | null;
    await client
      .from("customers")
      .update({
        purchases: Number(row?.purchases ?? 0) + 1,
        total_spent: Number(row?.total_spent ?? 0) + Number(sale["price"]),
        last_seen_at: new Date().toISOString(),
      })
      .eq("phone", phone);
  }

  return { id: String(sale["id"]), receipt: input.receipt ?? null };
}

function mapOrder(row: Record<string, unknown>): Order {
  const status = String(row["status"]);
  return {
    id: String(row["id"]),
    offerId: String(row["offer_id"]),
    offerTitle: String(row["offer_title"]),
    service: String(row["service"]),
    amount: Number(row["price"]),
    commission: Number(row["commission"]),
    paymentPhone: String(row["payment_phone"]),
    receivingPhone: String(row["receiving_phone"]),
    status: status === "paid" || status === "failed" ? status : "pending",
    receipt: (row["mpesa_receipt"] as string | null) ?? null,
    resultDesc: (row["result_desc"] as string | null) ?? null,
    destination: String(row["destination"] ?? ""),
    createdAt: String(row["created_at"]),
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const settings = await getStoreSettings();
  const client = await db();
  const [salesResult, customerResult, withdrawalResult] = await Promise.all([
    client.from("sales").select("*").order("created_at", { ascending: false }).limit(300),
    client.from("customers").select("*").order("last_seen_at", { ascending: false }).limit(300),
    client.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  const orders = (salesResult.data ?? []).map((row) => mapOrder(row as Record<string, unknown>));
  const paid = orders.filter((order) => order.status === "paid");
  const earned = paid.reduce((sum, order) => sum + order.commission, 0);
  const withdrawals = (withdrawalResult.data ?? []).map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id: String(item["id"]),
      amount: Number(item["amount"]),
      phone: (item["phone"] as string | null) ?? null,
      createdAt: String(item["created_at"]),
    };
  });
  const withdrawn = withdrawals.reduce((sum, item) => sum + item.amount, 0);
  const available = Math.max(0, earned - withdrawn);
  const threshold = settings.withdrawThreshold || 10;
  const withdrawable = Math.floor(available / threshold) * threshold;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const paidToday = paid.filter((order) => new Date(order.createdAt) >= startOfDay);

  const dealTotals = new Map<string, { title: string; count: number; revenue: number }>();
  for (const order of paid) {
    const current = dealTotals.get(order.offerId) ?? {
      title: order.offerTitle,
      count: 0,
      revenue: 0,
    };
    current.count += 1;
    current.revenue += order.amount;
    dealTotals.set(order.offerId, current);
  }

  return {
    balance: settings.floatBalance,
    businessName: settings.businessName,
    supportPhone: settings.supportPhone,
    salesCount: paid.length,
    revenue: paid.reduce((sum, order) => sum + order.amount, 0),
    revenueToday: paidToday.reduce((sum, order) => sum + order.amount, 0),
    salesToday: paidToday.length,
    pendingCount: orders.filter((order) => order.status === "pending").length,
    failedCount: orders.filter((order) => order.status === "failed").length,
    totalCommissions: Number(earned.toFixed(2)),
    withdrawableCommissions: Number(withdrawable.toFixed(2)),
    pendingCommissions: Number((available - withdrawable).toFixed(2)),
    orders,
    customers: (customerResult.data ?? []).map((row) => {
      const item = row as Record<string, unknown>;
      return {
        phone: String(item["phone"]),
        salesCount: Number(item["purchases"] ?? 0),
        totalSpend: Number(item["total_spent"] ?? 0),
        lastSeen: String(item["last_seen_at"]),
      };
    }),
    withdrawals,
    topDeals: [...dealTotals.values()].sort((a, b) => b.count - a.count).slice(0, 5),
  };
}

export async function requestCommissionWithdrawal(phone?: string | null) {
  const dashboard = await getDashboardData();
  const amount = dashboard.withdrawableCommissions;
  if (!amount) return { amount: 0 };
  const client = await db();
  await client
    .from("withdrawals")
    .insert({ amount, phone: phone ?? null, status: "requested" });
  return { amount };
}
