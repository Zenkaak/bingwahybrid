# Bingwa Sokoni Deals

Build a proffesional bingwa sokoni app. It shows all this packages *CURRENTLY AUTOMATED OFFERS*🥳

_MARTHA WAMBUI🔥_

OFFLINE TILL: 4211224

🔥🔂*Bingwa Data Buy only once per day per number* 

✅️:Ksh.19=1GB,1hour(_available from 11pm-4pm_)

✅️:Ksh.20=250Mbs,24 hours

✅️:Ksh.49=400Mbs,7days

✅Ksh.55=750mbs+50sms 24hrs

✅️:Ksh.99=1.5GB,24hrs

✅Ksh.299=2.5GB weekly

Offline till: 4211224

🔥♻️ _SMS Buy many times /day_ 

✅Ksh.5=20 SMS 

✅Ksh.10=200 SMS 

✅Ksh.30=1000 SMS 7days

📢*Please Note:* 1GB hourly data(Sh23&Sh19) _offer will only be available daily from 11:00Pm to 4:00Pm_

---

_If you buy 1GB after 4pm daily you will get 250MBs + free WhatsApp_

🔥♻️*Minutes available*

✅Ksh.22= 45 mins 3hours

✅Ksh.51= 60 mins midnight

Offline till: 4211224

🔥♻️ _Tunukiwa data Buy many times /day_  

✅Ksh.23= 1GB 1 hour(_available from 11pm-4pm_)

✅Ksh.52=750mbs 24hrs

✅Ksh.110= 2GB 24hours

Offline till: 4211224

 

 Offline Till Number _4211224_

Till name _MARTHA WAMBUI_

The public catalog is available at `/`. Dealer reporting is protected at `/admin` with the existing PIN `9898`; it keeps float, sales, commissions, customers, and gateway settings out of shared product links.

## Vercel storage configuration

The private admin dashboard, sales ledger, customer records, float balance, gateway settings, and commission withdrawals use Vercel-compatible Postgres storage. Add one server-only connection variable to the Vercel Production environment:

- POSTGRES_URL (Vercel Postgres or Neon connection string)

The application also accepts DATABASE_URL as a fallback. On the first server request it creates the required tables and seeds the default settings row with admin PIN 9898, editable till 3367738, paybill 4211224, commission 1.5 per KES 10, and withdrawal threshold 10. Never expose the database connection string as a VITE_* variable.

Supabase is no longer required for these admin and sales records. Existing Supabase records are not copied automatically; they remain in the old database unless a separate migration is requested.

## Daraja configuration

The payment prompts run server-side and do not require Supabase. Configure these variables in the
Vercel project environment:

- `DARAJA_CONSUMER_KEY`
- `DARAJA_CONSUMER_SECRET`
- `DARAJA_PASSKEY`
- `DARAJA_SHORTCODE` (server-only payment shortcode; never display it in the UI)
- `DARAJA_ENV` (`sandbox` or `production`)
- `DARAJA_ACCOUNT_TYPE` (`till` or `paybill`)
- `DARAJA_CALLBACK_URL` (the public `/api/public/mpesa-callback` URL)

M-Pesa sales are confirmed with the Daraja STK query endpoint before they are recorded. Sales and
customers are stored in PostgreSQL. Commission is 15% (KES 10 in sales earns KES 1.50), and each
complete KES 10 commission block becomes withdrawable in `/admin`. Offline payments use till
`4211224`; M-Pesa prompts use the server-only Daraja shortcode unless the admin enables the
editable prompt gateway till.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bingwahybrid.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7a13cdbd-4e2a-4a53-a4b2-1ec00881d022).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
