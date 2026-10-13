# Provider onboarding and clearance

## Operator flow

`/operators.html`: confirmed account -> business/service-area profile -> machine inventory and operator qualifications -> complete contract reading and explicit electronic signature -> insurance details -> private uploads with optional live AI checks -> submission -> independent human verification and LiftCrew countersignature -> approved work eligibility. Corrections reopen the application and suspend eligibility. The marketing and customer booking flows are unchanged. The read-only status screen checks for reviewer decisions every ten seconds while visible.

Machine inventory includes category, make/model/year/serial, ownership, capacity (lb), load center (in) or crane working radius (ft), lift height/reach (ft), width/stowed height (in), operating weight, power, terrain, attachments, replacement value, base ZIP, availability, inspections, delivery and restrictions. Matching is a candidate shortlist, not a lift calculation or dispatch authorization. Explicit service ZIPs are matched; travel radius is not represented as measured distance. Cranes are stored but excluded from forklift matches pending a separate specialty agreement.

## Production activation

1. Apply all three migrations: `20261013150000_provider_clearance.sql`, `20261013150100_provider_clearance_hardening.sql`, and `20261013150200_provider_review_context.sql`.
2. Deploy `supabase/functions/insurance-review` with gateway `verify_jwt=false`. The handler implements custom authentication: it verifies the actual user JWT with `auth.getUser(token)` and requires a confirmed email before every action. It uses that verified bearer token for owner-scoped RPCs, never a user-supplied owner ID.
3. Configure **OPENAI_API_KEY as a Supabase Edge Function secret**, never a public Vite variable or repository file. Optional `INSURANCE_REVIEW_MODEL` defaults to `gpt-4.1`. Missing credentials, timeouts, malformed output and unreadable packets route to human review. The reviewer-only service-status table stores only a boolean configuration signal and model/rules version, not credentials.
4. Sign in to `/operator-review.html` with an existing authorized, email-confirmed reviewer account. Under **Onboarding settings**, publish the complete counsel/broker-reviewed agreement with the true contracting entity, notice address/email, completed venue/contacts and all other terms, plus Schedule A. No entity or company signature has been invented. The October 12 five-page draft is not automatically finalized. Published versions and signed envelopes are immutable.
5. Verify production authentication email delivery, confirmation links and password recovery. Do not disable email confirmation to bypass delivery problems.
6. Test a controlled redacted insurance packet with the configured model and obtain broker validation of the extraction/rules before relying on it operationally. Test real provider and company signing only with the finalized agreement. Synthetic tests do not authenticate a real insurance policy.

## Insurance review

The operator authorizes AI processing explicitly; human review is available without it. After all six insurance sections are uploaded, review starts automatically. A server RPC records an immutable manifest, profile/contract-context snapshot, consent version and fingerprint. Duplicate identical reviews are reused. Limits: five requested reviews per provider/hour, 200 across the service/24 hours, up to 12 insurance files/24 MB total per extraction, and 10 MB per individual upload. W-9s, equipment photos and qualification records are excluded from model inputs by upload-kind allowlist. A misfiled tax document in an insurance section is still sensitive: the UI and privacy notice prohibit misfiling.

A service-only worker claims the job, validates file signatures and sizes, computes SHA-256 hashes and calls the Responses API with `store:false`, PDF/image inputs and strict structured output. File contents are untrusted and never receive tools. No user URL is fetched. Findings must reference supplied document IDs, pages and excerpts; missing, conflicting or low-confidence evidence is unknown, not assumed true. Deterministic code checks dates and numeric minima. The review is bound to the provider's actual signed contract legal entity, or the latest published version before signing. A changed fingerprint makes an old result stale.

Rules follow Schedule A v2 dated October 12, 2026: CGL $1M occurrence/$2M general aggregate/$2M products-completed aggregate; auto $1M CSL; statutory WC including working owners; employers liability $1M at all three limits; umbrella $2M occurrence/aggregate; handling at least the greater of $250K or declared total exposed value; adequate equipment replacement values; required actual endorsement/handling terms; retentions above $10K flagged. Changing the published requirements also requires changing the rules and tests.

Policy authenticity, current in-force status, insurer authorization/AM Best, working-owner arrangements, exclusions, notices, completed-operations/claims-made requirements and specialty exceptions require independent verification. A COI alone is not sufficient. No external insurer-verification integration is configured by this change.

## Approval, corrections and security

`provider_clearance` is the server-side source of truth. Approval requires the confirmed reviewer role, all business/qualification/insurance/tax checks, an independent verification reference, a verified earliest future expiry, current both-party signatures and unexpired records. Profile/document edits require reopening, which removes approved status. Eligibility is checked again for equipment matching, including current evidence, insurance dates and operator-evaluation dates.

An AI failure cannot silently be ignored. Resolve and rerun the packet. Where an authorized reviewer independently proves an extraction error or documents an approved risk exception, the verification reference must start with `AI_CORRECTION:` and contain at least 100 characters describing every affected finding, policy/page evidence, verification source/date and any signed exception. The reference remains in the review audit. This is a human decision, not AI approval, and cannot waive mandatory coverage.

Every new public table has RLS. Applicants have owner-scoped reads for their envelopes/reviews and cannot directly write signatures, AI results, review decisions or contract versions. Changes use narrowly granted RPCs. Only service-role code can claim/finish AI jobs; that role is not granted direct write access to contract/signature/review tables. Existing private reviewer allowlists have no ordinary-user table grants. Signature triggers prevent changes to the signed text or signer audit. Records include authenticated account IDs, server timestamps, exact text/hash, names, authority and consent version. They are not biometric identity proof or proof of comprehension.

The reviewer portal offers candidate equipment search, private document review, exact contract display/download, explicit company countersigning, verification fields, specific applicant feedback and audit history. This implements onboarding eligibility and candidate matching, not a job-offer messaging, reservation or dispatch engine. Each assignment still needs a Work Order and lift/site assessment.

## Validation

Run `node --test tests/*.test.mjs` and `npm run build`. Synthetic insurance tests cover expired/future dates, mismatched names, fabricated evidence IDs, low confidence, missing endorsements, numeric thresholds, retentions, malformed output, stale rendering, privacy allowlists and XSS. Production schema tests should use rollback-only transactions to exercise RLS, forbidden self-approval, signature immutability, countersigning, clearance, expiry and matching. Never leave test contracts, users or approvals in production.

Official implementation references:
- https://developers.openai.com/api/docs/guides/file-inputs
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://supabase.com/docs/guides/functions/background-tasks
