---
name: Vercel admin prerequisites
description: Deployment requirements for the private admin dashboard and gateway settings.
---

The private dashboard depends on a server-only Supabase privileged key and the seeded app settings row; public Supabase keys are not sufficient for admin reads.

**Why:** The storefront can render with publishable credentials while admin requests fail at runtime when the privileged key or row is absent.

**How to apply:** Keep the service/secret key in Vercel server environment variables, never under VITE_*, and verify app_settings id 1 exists before debugging the admin UI.
