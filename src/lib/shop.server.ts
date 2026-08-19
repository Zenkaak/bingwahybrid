import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { performStkPush, performStkQuery } from "@/lib/mpesa.functions";

export type PurchaseInput = {
  offerId: string;
  offerTitle: string;
  service: string;
  price: number;
  paymentPhone: string;
  receivingPhone: string;
  forSelf: boolean;
};

function normalize(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

async function loadSettings() {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) throw new Error("Settings are not available right now.");
  return data;
}

export async function getShopConfig() {
  const settings = await loadSettings();
  return {
    ok: true as const,
    tillNumber: settings.till_number,
    paybillNumber: settings.paybill_number,
    gatewayEnabled: settings.gateway_enabled,
    commissionPerTen: Number(settings.commission_per_ten),
    withdrawThreshold: Number(settings.withdraw_threshold),
  };
}

export async function startPurchase(input: PurchaseInput) {
  const settings = await loadSettings();
  const paymentPhone = normalize(input.paymentPhone);
  const receivingPhone = normalize(input.forSelf ? input.paymentPhone : input.receivingPhone);
  const commission = (input.price / 10) * Number(settings.commission_per_ten);
  const destination = settings.gateway_enabled ? settings.till_number : settings.paybill_number;

  await supabaseAdmin.from("customers").upsert(
    { phone: receivingPhone, last_seen_at: new Date().toISOString() },
    { onConflict: "phone", ignoreDuplicates: false },
  );

  const push = await performStkPush({
    phone: paymentPhone,
    amount: input.price,
    reference: input.offerId,
    description: `${input.offerTitle} for ${receivingPhone}`.slice(0, 60),
    ...(settings.gateway_enabled ? { till: settings.till_number } : {}),
  });

  const { data: sale } = await supabaseAdmin
    .from("sales")
    .insert({
      offer_id: input.offerId,
      offer_title: input.offerTitle,
      service: input.service,
      price: input.price,
      commission,
      payment_phone: paymentPhone,
      receiving_phone: receivingPhone,
      for_self: input.forSelf,
      gateway_enabled: settings.gateway_enabled,
      destination,
      status: push.ok ? "pending" : "failed",
      checkout_request_id: push.ok ? push.checkoutRequestId : null,
    })
    .select("id")
    .single();

  if (!push.ok) {
    return { ok: false as const, error: push.error };
  }

  return {
    ok: true as const,
    saleId: sale?.id ?? null,
    checkoutRequestId: push.checkoutRequestId,
    destination,
    gatewayEnabled: settings.gateway_enabled,
  };
}

export async function confirmPurchase(input: { saleId: string; checkoutRequestId: string }) {
  const result = await performStkQuery({ checkoutRequestId: input.checkoutRequestId });
  if (!result.ok) return result;

  const { data: sale } = await supabaseAdmin
    .from("sales")
    .select("*")
    .eq("id", input.saleId)
    .maybeSingle();

  if (!sale) return result;

  if (result.status === "success" && sale.status !== "paid") {
    await supabaseAdmin.from("sales").update({ status: "paid" }).eq("id", sale.id);

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("purchases, total_spent")
      .eq("phone", sale.receiving_phone)
      .maybeSingle();

    await supabaseAdmin
      .from("customers")
      .update({
        purchases: (customer?.purchases ?? 0) + 1,
        total_spent: Number(customer?.total_spent ?? 0) + Number(sale.price),
        last_seen_at: new Date().toISOString(),
      })
      .eq("phone", sale.receiving_phone);
  }

  if (result.status === "failed" && sale.status === "pending") {
    await supabaseAdmin.from("sales").update({ status: "failed" }).eq("id", sale.id);
  }

  return { ...result, destination: sale.destination, receivingPhone: sale.receiving_phone };
}

async function requirePin(pin: string) {
  const settings = await loadSettings();
  if (!pin || pin !== settings.admin_pin) {
    throw new Error("Wrong PIN.");
  }
  return settings;
}

export async function adminSnapshot(pin: string) {
  const settings = await requirePin(pin);
  const [{ data: sales }, { data: customers }, { data: withdrawals }] = await Promise.all([
    supabaseAdmin.from("sales").select("*").order("created_at", { ascending: false }).limit(200),
    supabaseAdmin
      .from("customers")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("withdrawals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const paid = (sales ?? []).filter((s) => s.status === "paid");
  const earned = paid.reduce((sum, s) => sum + Number(s.commission), 0);
  const withdrawn = (withdrawals ?? []).reduce((sum, w) => sum + Number(w.amount), 0);
  const available = Math.max(0, earned - withdrawn);

  return {
    ok: true as const,
    settings: {
      tillNumber: settings.till_number,
      paybillNumber: settings.paybill_number,
      gatewayEnabled: settings.gateway_enabled,
      commissionPerTen: Number(settings.commission_per_ten),
      withdrawThreshold: Number(settings.withdraw_threshold),
      floatBalance: Number(settings.float_balance),
      activated: settings.activated,
    },
    totals: {
      salesCount: paid.length,
      revenue: paid.reduce((sum, s) => sum + Number(s.price), 0),
      commissionEarned: earned,
      commissionWithdrawn: withdrawn,
      commissionAvailable: available,
      withdrawable: available >= Number(settings.withdraw_threshold),
      customers: (customers ?? []).length,
    },
    sales: sales ?? [],
    customers: customers ?? [],
    withdrawals: withdrawals ?? [],
  };
}

export async function adminUpdateSettings(
  pin: string,
  patch: {
    tillNumber?: string;
    paybillNumber?: string;
    gatewayEnabled?: boolean;
    floatBalance?: number;
    activated?: boolean;
    adminPin?: string;
  },
) {
  await requirePin(pin);
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.tillNumber) update["till_number"] = patch.tillNumber;
  if (patch.paybillNumber) update["paybill_number"] = patch.paybillNumber;
  if (typeof patch.gatewayEnabled === "boolean") update["gateway_enabled"] = patch.gatewayEnabled;
  if (typeof patch.floatBalance === "number") update["float_balance"] = patch.floatBalance;
  if (typeof patch.activated === "boolean") {
    update["activated"] = patch.activated;
    update["activated_at"] = patch.activated ? new Date().toISOString() : null;
  }
  if (patch.adminPin && /^\d{4}$/.test(patch.adminPin)) update["admin_pin"] = patch.adminPin;

  const { error } = await supabaseAdmin.from("app_settings").update(update).eq("id", 1);
  if (error) return { ok: false as const, error: "Could not save settings." };
  return adminSnapshot(pin);
}

export async function adminWithdraw(pin: string, phone: string | null) {
  const settings = await requirePin(pin);
  const snapshot = await adminSnapshot(pin);
  const available = snapshot.totals.commissionAvailable;
  if (available < Number(settings.withdraw_threshold)) {
    return {
      ok: false as const,
      error: `You need at least KES ${settings.withdraw_threshold} in commission to withdraw.`,
    };
  }
  await supabaseAdmin
    .from("withdrawals")
    .insert({ amount: available, phone, status: "requested" });
  return adminSnapshot(pin);
}
