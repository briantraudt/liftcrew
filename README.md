# LiftCrew

Vite marketing, customer quote intake and provider onboarding, hosted on Vercel with Supabase authentication, private storage and database review gates.

## Development

```sh
npm ci
npm run dev
node --test tests/*.test.mjs
npm run build
```

Vite builds `dist/`. `/api/*` endpoints are Vercel serverless functions; the Vite development server does not execute them.

## Provider onboarding

`/operators.html`: verified signup → business → equipment → operators with equipment selections → read and electronically sign → one insurance packet → supporting records → submit. Profiles resume after login. ZIP coverage is computed server-side using ZIP centers and mileage radius; it is not driving distance. Qualification, capacity, site and insurance checks remain necessary for every job.

`/operator-confirmed.html` verifies the callback, removes credentials from the URL, and asks the user to sign in. It never treats an ordinary direct page visit as a confirmed email. Hosted Supabase URL settings must allow the production callback; a Git push alone does not change those settings.

`/operator-agreement.html` serves the actual published v2 agreement, not the archived v1 draft. Its body hash must match before actions are displayed. Personalized signature records bind the exact contract text, business identity, authenticated signer, authority, consent and server timestamp. LiftCrew countersigns separately. Publication is not a company signature or provider approval. See `docs/provider-agreement-publication.md`.

The `insurance-review` Edge Function reads consented insurance uploads using a server-only OpenAI key. One combined packet can support multiple coverage requirements. Tax, equipment-photo and training upload kinds are excluded from the model manifest. Unclear or unavailable extraction goes to human review, never automatic approval. Authenticity/current coverage require independent verification. See `docs/onboarding-release-20261013.md` for the current packet and equipment-authorization model.

## Equipment pricing and customer travel

Each machine in `/operators.html` records its own base ZIP, hourly rate, 4-hour rate, and daily rate. Providers also set a maximum service radius in Business. That limit is applied separately to every machine's ZIP. The included delivery radius is **25 miles one way**; for longer trips the mileage allowance is **$2 per excess round-trip mile**. At 40 miles one way, the excess is 15 miles in each direction: 30 billable miles × $2 = **$60**.

`/api/equipment-pricing` returns a price preview for the nearest **currently approved**, suitable forklift/telehandler with a trained authorized operator, valid provider clearance and all three rates. Matching uses the job ZIP and machine ZIP centroids (straight-line estimates), not road routing; actual delivery mileage, compatibility, availability, site constraints and transport arrangements require confirmation. Hourly and 4-hour rates are displayed as single-session prices, with daily totals multiplied by booking days. Crane inquiries remain manual until separate specialty authorization is implemented.

Price previews are calculated on the server with the existing `CUSTOMER_INTAKE_KEY`; provider identities and private records are not sent to the browser. Every customer intake stores an **independent server-calculated price snapshot** in `customer_requests.pricing_snapshot`, shown in the staff inbox and email alerts. Failed price matching never prevents durable quote intake. Apply `supabase/migrations/20261020160000_equipment_pricing.sql` before deploying the updated frontend and API.

## Staff access

- `/staff-login.html`: staff signup, verified sign-in, invitation/password-reset handling. Staff do not need a provider application.
- `/operator-review.html`: reviewer-only provider management, contract countersignature, independent-verification records, corrections and approvals.
- `/customer-requests.html`: reviewer-only customer request inbox, request status, contact details and email retry.

Reviewer authority comes from private owner-maintained tables and a confirmed email, never editable user metadata. Creating a staff login does not grant reviewer rights. The owner's authorized email is configured separately from registration; the owner must create and verify the account and choose their own password.

## Customer request delivery

Forklift and crane quote submissions are validated and saved to `public.customer_requests` **before** attempting email. Success returns a durable request reference, not a claim of an email reaching an inbox or a confirmed booking. Existing crane inquiries are copied into the unified staff inbox without deleting originals.

The browser retains a request UUID for retries of unchanged form details. The database deduplicates the same reference/payload and rejects conflicting reuse. The narrow intake RPC requires a server-only credential, applies per-IP-hash/per-email and global volume limits, and grants no public access to customer data. Approved staff alone can read requests and change their status.

Email is secondary: missing credentials or a failed send cannot erase or reject a saved inquiry. Staff see `pending`, `unconfigured`, `sending`, `accepted`, `failed` or `delivery_unknown`. `accepted` means the email provider accepted the send, **not** inbox delivery. Retries use the same Resend idempotency key, with bounded attempts and a conservative retry window. There is no background retry scheduler in this release; staff can retry a saved request from the inbox.

### Server configuration

- `CUSTOMER_INTAKE_KEY`: high-entropy server secret in Vercel; its SHA-256 is held in `private.customer_intake_credentials`. Never expose it in Vite variables, browser bundles, source control or logs.
- `QUOTE_TO_EMAIL`: designated LiftCrew staff inbox.
- `RESEND_API_KEY` and `QUOTE_FROM_EMAIL`: required only for email alerts. Use an authorized, verified sender domain. Do not claim delivery before checking the provider/inbox.
- `OPENAI_API_KEY`: Supabase Edge Function secret only; optional `INSURANCE_REVIEW_MODEL` defaults to `gpt-4.1`.

Deploy after Vercel environment changes. Do not copy secrets into this repository. The frontend uses only the Supabase publishable key.

### Hosted authentication setup

Set Supabase Site URL to `https://www.myliftcrew.com`. Allow these exact production redirects and the deliberate apex equivalents:

- `https://www.myliftcrew.com/operator-confirmed.html`
- `https://www.myliftcrew.com/operators.html`
- `https://www.myliftcrew.com/staff-login.html`

The existing operator frontend also requests `https://myliftcrew.com/operator-confirmed.html` and `https://myliftcrew.com/operators.html`; include those exact URLs. Keep email confirmation enabled, use a working transactional SMTP sender, and keep the confirmation template's supported confirmation link. Old localhost links cannot be repaired by publishing a new page. Test fresh signup, resend and recovery from a real authorized inbox.

## Security and verification

Apply migrations in order for a new environment. The published agreement is authorized production business data, not an automatic seed. Public tables use RLS. Applicants cannot directly write approval, signature or AI-result fields. Intake secrets and reviewer lists remain private. Uploaded files are private but are **not malware-scanned**; handle W-9s and downloaded files appropriately. Renewal and decision email reminders are not implemented.

Unit/API tests: `node --test tests/*.test.mjs`. Browser checks: build, start preview on port 4173, then run `tests/operator-onboarding.browser.mjs` and `tests/staff-inbox.browser.mjs` with the optional `playwright-core` / `@sparticuz/chromium` test dependencies and required Linux browser libraries. Browser identity fixtures are mocked; they are not evidence of real email delivery. Production database QA uses rollback-only synthetic fixtures; no synthetic signature or approval should remain.

This release covers onboarding, clearance and candidate matching. It does not implement provider job offers, scheduling/reservations, work-order acceptance, customer payments, or automated dispatch. Current job-specific requirements still apply.
