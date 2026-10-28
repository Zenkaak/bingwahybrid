import { Pool, type QueryResultRow } from "pg";

export type GatewaySettings = { enabled: boolean; till: string };
export type Deal = { id: string; groupKey: string; title: string; price: number; validity: string; note: string | null; sortOrder: number; active: boolean };
export type Order = { id: string; offerId: string; offerTitle: string; service: string; amount: number; commission: number; paymentPhone: string; receivingPhone: string; status: "pending" | "paid" | "failed"; receipt: string | null; resultDesc: string | null; destination: string; createdAt: string };
export type DashboardData = {
 balance: number; businessName: string; supportPhone: string; salesCount: number; revenue: number; revenueToday: number;
 salesToday: number; pendingCount: number; failedCount: number; totalCommissions: number; withdrawableCommissions: number;
 pendingCommissions: number; orders: Order[];
 customers: Array<{phone:string;salesCount:number;totalSpend:number;lastSeen:string}>;
 withdrawals: Array<{id:string;amount:number;phone:string|null;createdAt:string}>;
 topDeals: Array<{title:string;count:number;revenue:number}>;
};

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const globalPool = globalThis as typeof globalThis & { __bingwaHybridPool?: Pool };
function getPool() {
 if (!connectionString) throw new Error("PostgreSQL connection is not configured (POSTGRES_URL or DATABASE_URL).");
 if (!globalPool.__bingwaHybridPool) globalPool.__bingwaHybridPool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000 });
 return globalPool.__bingwaHybridPool;
}
async function query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
 return getPool().query<T>(sql, values);
}
let settingsCache: {row: Record<string, unknown>; at: number} | null = null;
async function loadSettings() {
 if (settingsCache && Date.now() - settingsCache.at < 5000) return settingsCache.row;
 try {
  const result = await query("SELECT * FROM app_settings WHERE id = 1");
  if (!result.rows[0]) throw new Error("Missing app_settings row id=1");
  settingsCache = {row: result.rows[0] as Record<string, unknown>, at: Date.now()};
  return settingsCache.row;
 } catch (error) {
  console.error("[settings] PostgreSQL load failed", error instanceof Error ? error.message : "unknown error");
  throw new Error("Settings are not available right now.");
 }
}
export async function getAdminPin() { try { return String((await loadSettings()).admin_pin || "9898"); } catch { return "9898"; } }
export async function getGatewaySettings(): Promise<GatewaySettings> {
 const s = await loadSettings(); const till = String(s.till_number ?? "");
 return {enabled:s.gateway_enabled === true, till:/^\d{5,10}$/.test(till) ? till : "3367738"};
}
export async function getStoreSettings() {
 const s = await loadSettings();
 return {enabled:s.gateway_enabled === true, till:String(s.till_number ?? "3367738"), paybill:String(s.paybill_number ?? "4211224"),
  businessName:String(s.business_name ?? "BLACK HOLE BINGWA SERVICES"), supportPhone:String(s.support_phone ?? "0769252572"),
  commissionPerTen:Number(s.commission_per_ten ?? 1.5), withdrawThreshold:Number(s.withdraw_threshold ?? 10), floatBalance:Number(s.float_balance ?? 0)};
}
export async function updateStoreSettings(patch:{enabled?:boolean;till?:string;paybill?:string;businessName?:string;supportPhone?:string;adminPin?:string}) {
 const sets:string[]=[]; const vals:unknown[]=[];
 const add=(column:string,value:unknown)=>{vals.push(value);sets.push(column+" = $"+vals.length);};
 if(typeof patch.enabled==="boolean") add("gateway_enabled",patch.enabled);
 if(patch.till) add("till_number",patch.till); if(patch.paybill) add("paybill_number",patch.paybill);
 if(patch.businessName) add("business_name",patch.businessName); if(patch.supportPhone) add("support_phone",patch.supportPhone);
 if(patch.adminPin && /^\d{4,6}$/.test(patch.adminPin)) add("admin_pin",patch.adminPin);
 if(sets.length){sets.push("updated_at = now()");await query("UPDATE app_settings SET "+sets.join(", ")+" WHERE id=1",vals);}
 settingsCache=null; return getStoreSettings();
}
export async function updateGatewaySettings(settings:GatewaySettings){await updateStoreSettings({enabled:settings.enabled,till:settings.till});return settings;}
export async function addFloat(amount:number){
 if(!Number.isFinite(amount)||amount<=0) throw new Error("Amount must be positive.");
 const r=await query<{float_balance:string|number}>("UPDATE app_settings SET float_balance=float_balance+$1,updated_at=now() WHERE id=1 RETURNING float_balance",[amount]);
 if(!r.rows[0]) throw new Error("Could not add float."); settingsCache=null; return Number(r.rows[0].float_balance);
}
function mapDeal(r:Record<string,unknown>):Deal{return {id:String(r.id),groupKey:String(r.group_key),title:String(r.title),price:Number(r.price),validity:String(r.validity),note:(r.note as string|null)??null,sortOrder:Number(r.sort_order??0),active:r.active!==false};}
export async function listDeals(options?:{activeOnly?:boolean}){
 const r=await query("SELECT * FROM deals"+(options?.activeOnly?" WHERE active=true":"")+" ORDER BY group_key ASC, sort_order ASC");
 return r.rows.map(row=>mapDeal(row as Record<string,unknown>));
}
export async function saveDeal(d:Deal){
 await query(`INSERT INTO deals(id,group_key,title,price,validity,note,sort_order,active,updated_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()) ON CONFLICT(id) DO UPDATE SET group_key=EXCLUDED.group_key,title=EXCLUDED.title,
 price=EXCLUDED.price,validity=EXCLUDED.validity,note=EXCLUDED.note,sort_order=EXCLUDED.sort_order,active=EXCLUDED.active,updated_at=now()`,
 [d.id,d.groupKey,d.title,d.price,d.validity,d.note,d.sortOrder,d.active]); return listDeals();
}
export async function deleteDeal(id:string){await query("DELETE FROM deals WHERE id=$1",[id]);return listDeals();}
export function normalizePhone(input:string){const d=input.replace(/\D/g,"");if(d.startsWith("254"))return d;if(d.startsWith("0"))return "254"+d.slice(1);if(d.length===9)return "254"+d;return d;}
export async function createPendingSale(input:{deal:Deal;paymentPhone:string;receivingPhone:string;checkoutRequestId:string|null}){
 const s=await getStoreSettings(); const commission=(input.deal.price/10)*s.commissionPerTen; const destination=s.enabled?s.till:s.paybill;
 const paymentPhone=normalizePhone(input.paymentPhone), receivingPhone=normalizePhone(input.receivingPhone);
 const client=await getPool().connect();
 try {
  await client.query("BEGIN");
  await client.query("INSERT INTO customers(phone,last_seen_at) VALUES($1,now()) ON CONFLICT(phone) DO UPDATE SET last_seen_at=now()",[receivingPhone]);
  const r=await client.query<{id:string}>(`INSERT INTO sales(offer_id,offer_title,service,price,commission,payment_phone,receiving_phone,for_self,gateway_enabled,destination,status,checkout_request_id)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11) RETURNING id`,
  [input.deal.id,input.deal.title+" · "+input.deal.validity,input.deal.groupKey,input.deal.price,commission,paymentPhone,receivingPhone,paymentPhone===receivingPhone,s.enabled,destination,input.checkoutRequestId]);
  await client.query("COMMIT"); return {id:String(r.rows[0].id),commission,destination};
 } catch(error){await client.query("ROLLBACK");console.error("[sales] insert failed",error instanceof Error?error.message:"unknown error");throw new Error("Could not record the order.");}
 finally{client.release();}
}
export async function markSaleResult(input:{saleId?:string|null;checkoutRequestId?:string|null;status:"paid"|"failed";receipt?:string|null;resultDesc?:string|null}){
 const client=await getPool().connect();
 try {
  await client.query("BEGIN");
  const selector=input.saleId?"id = $1":"checkout_request_id = $1";
  const key=input.saleId??input.checkoutRequestId??"";
  const found=await client.query("SELECT * FROM sales WHERE "+selector+" LIMIT 1 FOR UPDATE",[key]);
  const sale=found.rows[0] as Record<string,unknown>|undefined;
  if(!sale){await client.query("COMMIT");return null;}
  const alreadyPaid=sale.status==="paid";
  await client.query("UPDATE sales SET status=$1,mpesa_receipt=COALESCE($2,mpesa_receipt),result_desc=COALESCE($3,result_desc),updated_at=now() WHERE id=$4",
   [input.status,input.receipt??null,input.resultDesc??null,sale.id]);
  if(input.status==="paid"&&!alreadyPaid){
   await client.query(`INSERT INTO customers(phone,purchases,total_spent,last_seen_at) VALUES($1,1,$2,now())
    ON CONFLICT(phone) DO UPDATE SET purchases=customers.purchases+1,total_spent=customers.total_spent+EXCLUDED.total_spent,last_seen_at=now()`,
    [String(sale.receiving_phone),Number(sale.price)]);
  }
  await client.query("COMMIT"); return {id:String(sale.id),receipt:input.receipt??(sale.mpesa_receipt as string|null)??null};
 } catch(error){await client.query("ROLLBACK");console.error("[sales] result update failed",error instanceof Error?error.message:"unknown error");throw new Error("Could not update the order result.");}
 finally{client.release();}
}
function mapOrder(r:Record<string,unknown>):Order{const status=String(r.status);return {id:String(r.id),offerId:String(r.offer_id),offerTitle:String(r.offer_title),service:String(r.service),amount:Number(r.price),commission:Number(r.commission),paymentPhone:String(r.payment_phone),receivingPhone:String(r.receiving_phone),status:status==="paid"||status==="failed"?status:"pending",receipt:(r.mpesa_receipt as string|null)??null,resultDesc:(r.result_desc as string|null)??null,destination:String(r.destination??""),createdAt:new Date(String(r.created_at)).toISOString()};}
export async function getDashboardData():Promise<DashboardData>{
 const s=await getStoreSettings();
 const [sales,customers,withdrawalsR]=await Promise.all([
  query("SELECT * FROM sales ORDER BY created_at DESC LIMIT 300"),query("SELECT * FROM customers ORDER BY last_seen_at DESC LIMIT 300"),
  query("SELECT * FROM withdrawals ORDER BY created_at DESC LIMIT 100")]);
 const orders=sales.rows.map(r=>mapOrder(r as Record<string,unknown>));const paid=orders.filter(o=>o.status==="paid");
 const earned=paid.reduce((a,o)=>a+o.commission,0);
 const withdrawals=withdrawalsR.rows.map((r:Record<string,unknown>)=>({id:String(r.id),amount:Number(r.amount),phone:(r.phone as string|null)??null,createdAt:new Date(String(r.created_at)).toISOString()}));
 const available=Math.max(0,earned-withdrawals.reduce((a,w)=>a+w.amount,0));const threshold=s.withdrawThreshold||10;const withdrawable=Math.floor(available/threshold)*threshold;
 const start=new Date();start.setHours(0,0,0,0);const paidToday=paid.filter(o=>new Date(o.createdAt)>=start);
 const totals=new Map<string,{title:string;count:number;revenue:number}>();for(const o of paid){const t=totals.get(o.offerId)??{title:o.offerTitle,count:0,revenue:0};t.count++;t.revenue+=o.amount;totals.set(o.offerId,t);}
 return {balance:s.floatBalance,businessName:s.businessName,supportPhone:s.supportPhone,salesCount:paid.length,revenue:paid.reduce((a,o)=>a+o.amount,0),revenueToday:paidToday.reduce((a,o)=>a+o.amount,0),salesToday:paidToday.length,pendingCount:orders.filter(o=>o.status==="pending").length,failedCount:orders.filter(o=>o.status==="failed").length,totalCommissions:Number(earned.toFixed(2)),withdrawableCommissions:Number(withdrawable.toFixed(2)),pendingCommissions:Number((available-withdrawable).toFixed(2)),orders,
 customers:customers.rows.map((r:Record<string,unknown>)=>({phone:String(r.phone),salesCount:Number(r.purchases??0),totalSpend:Number(r.total_spent??0),lastSeen:new Date(String(r.last_seen_at)).toISOString()})),withdrawals,topDeals:[...totals.values()].sort((a,b)=>b.count-a.count).slice(0,5)};
}
export async function requestCommissionWithdrawal(phone?:string|null){
 const client=await getPool().connect();
 try {
  await client.query("BEGIN");
  const s=await client.query("SELECT * FROM sales WHERE status='paid'");
  const w=await client.query("SELECT COALESCE(SUM(amount),0) AS total FROM withdrawals");
  const earned=s.rows.reduce((a,r)=>a+Number(r.commission),0);
  const available=Math.max(0,earned-Number(w.rows[0]?.total??0));
  const settings=await client.query("SELECT withdraw_threshold FROM app_settings WHERE id=1");
  const threshold=Number(settings.rows[0]?.withdraw_threshold??10)||10;
  const amount=Math.floor(available/threshold)*threshold;
  if(!amount){await client.query("COMMIT");return {amount:0};}
  await client.query("INSERT INTO withdrawals(amount,phone,status) VALUES($1,$2,'requested')",[amount,phone??null]);
  await client.query("COMMIT");return {amount};
 } catch(error){await client.query("ROLLBACK");throw new Error("Could not request withdrawal.");}
 finally{client.release();}
}
export async function getDeal(id:string){const r=await query("SELECT * FROM deals WHERE id=$1 LIMIT 1",[id]);return r.rows[0]?mapDeal(r.rows[0] as Record<string,unknown>):null;}
