# Onboarding and request-delivery acceptance — October 13, 2026

Scope: preserve the already-shipped compact onboarding release, complete staff access entry points, make customer-request persistence independent of email, and verify onboarding and request boundaries. The base inspected was `16cb5c9e5370e614ff5580e728624a3d4cfe1a8d`.

## Verified before production release

- All 101 Node unit/API tests passed; Vite production build passed.
- Onboarding browser suite: 36 assertions across 1440px and 390px, covering layout, equipment selections, combined insurance upload and confirmation states. These use mocked identity/data, not an actual signup inbox.
- Staff/inbox browser suite: 24 assertions across the same sizes, covering signup/signin screens, expired callback handling, anonymous access denial, authorized request display, escaped customer input and staff status changes. Identity/data are mocked.
- Production database RPCs exercised using rollback-only synthetic fixtures: personalized published agreement, consent requirements, immutable signed terms, one insurance packet, exclusion of W-9 from the model manifest, duplicate review reuse, corrections and resubmission, cross-account access denial, self-approval refusal, independent approval checks, company countersignature, current clearance, authorized-equipment radius matching, expiry and reopening. All synthetic users, document metadata, signatures and decisions were rolled back.
- The resubmission test found timestamp ties could select an older decision. The added migration uses actual insertion timestamps and orders clearance decisions by revision, timestamp and ID; the full rollback test passed afterward.
- New customer-intake database RPCs passed credential, persistence, deduplication, payload-conflict, notification claim/state, private-data access, reviewer-only status change and rate-limit checks in a rollback transaction. No fixture or temporary credential change remained.
- Deployed insurance-review Edge Function version 3 contains the single-packet rules wrapper and core checks; no old six-upload deployment was substituted.

## Still blocked by hosted configuration / user identity

Supabase's hosted Auth URL configuration still rejects the production redirect URLs and falls back to `http://localhost:3000/`. This was verified with an invalid-token redirect probe that did not create or confirm an account. The available Supabase connection does not expose the hosted Auth settings write. A Git push is not a fix for that setting.

`brian@myliftcrew.com` is authorized in the private reviewer allowlist. No verified account at that address existed at the time of the check. The owner must create the login and verify it with a fresh real email after the URL/email configuration is corrected. No owner password, confirmation or company signature was fabricated, and no invitation email is claimed sent.

Customer requests now have a durable staff inbox. `CUSTOMER_INTAKE_KEY` and the designated recipient are configured on Vercel. Resend credentials and a verified sender remain missing, so staff email is not live. A Resend connection was offered to finish delivery configuration. The user interface distinguishes a saved request from an email accepted by the provider.

**The full real-user acceptance run is not a pass yet:** real signup-email arrival, the correct production confirmation redirect, owner verification/password login, and delivered staff email remain unverified/blocked. Component and synthetic tests above are not substituted for those checks.
