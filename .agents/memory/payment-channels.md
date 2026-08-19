---
name: Payment channel separation
description: Product rule for distinguishing server-side M-Pesa prompts from offline dealer payments.
---

M-Pesa prompts and offline dealer payments are separate channels: the Daraja shortcode stays server-only, while the offline till is the only payment number shown in the UI. Prompt account references must identify the service being paid for.

**Why:** Mixing the two channels caused invalid Daraja requests and exposed the prompt shortcode in the dealer-facing UI.

**How to apply:** Keep prompt configuration in server environment variables, keep offline till display constants in the frontend domain model, and use service names such as activation, float, data, sms, minutes, or tunukiwa as prompt references.

The private admin dashboard and public storefront are separate surfaces. Public pages must never load float, sales, commission, or customer data.

**Why:** Product links may be shared with customers, while dealer operations and customer history are private.

**How to apply:** Put dealer metrics behind the admin session and persist them server-side; never use browser-local dashboard state as the source of truth.
