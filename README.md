# LiftCrew

Responsive LiftCrew marketing website, built with Vite and a Vercel serverless quote endpoint.

## Run locally

```bash
npm install
npm run dev
```

`npm run build` produces the site in `dist/`. The quote API is served by Vercel and does not run through the Vite development server.

## Deploy to Vercel

Import `briantraudt/liftcrew` into Vercel. The framework is Vite, build command is `npm run build`, and output directory is `dist`. The `/api/quote` serverless function is deployed alongside the static site.

For quote delivery, verify a sending domain with [Resend](https://resend.com/domains) and set these Vercel environment variables for Production (and Preview if desired):

- `RESEND_API_KEY`: Resend API key.
- `QUOTE_TO_EMAIL`: inbox that should receive requests.
- `QUOTE_FROM_EMAIL`: verified sender address on your domain, such as `quotes@your-domain.com`.

Redeploy after setting the variables. Until they are configured, the form clearly reports that requests cannot be sent. No credentials belong in this repository.

After deployment, submit one real test request and confirm it reaches `QUOTE_TO_EMAIL` before directing customers to the form. The visible success message only appears after the email API reports success.

## Operator onboarding

- `/operators.html`: account creation, email confirmation, sign-in, password recovery, resumable applications, private uploads, electronic application certification and status.
- `/operator-review.html`: authenticated, explicitly authorized reviewer dashboard. Reviewers can request updates, decline, or approve after all checks and a finalized signed contract upload.
- `/operator-agreement.html`: complete proposed provider agreement, with a downloadable PDF. The application **acknowledges the draft**; it does not execute an agreement with missing legal fields.
- `/operator-privacy.html`: application privacy / electronic records notice.

### Backend

Supabase project `exokcxcxmmsnqejzhxwf`. Apply checked-in migrations in order when creating a new environment. They were applied to the existing project during implementation. The browser uses a publishable key, never a service-role key. RLS restricts applications, submissions and private objects by authenticated ownership; reviewer status comes from private owner-maintained tables, never user-editable metadata. Direct status changes and submission record writes are not granted to applicants. RPCs enforce submission and approval gates in the database.

Private bucket: `operator-documents`, 10 MB/file, PDF/JPEG/PNG/WebP. Client-side signature/type/size checks supplement storage limits. Files download as attachments. There is **no automated malware scanner**. Submitted application snapshots include agreement version/hash, typed name, authority, acknowledgements and server timestamp. Previously submitted documents are archived rather than deleted when replaced. Expiration warnings are checked when opening the portal; this release does not send renewal reminders or review emails and does not implement dispatch scheduling.

### Authentication setup before inviting public applicants

1. In Supabase Authentication → Email / SMTP, configure a verified transactional sender for this project. Supabase's default sender is restricted and is not a production public-signup email service. Keep email confirmation enabled.
2. Set Site URL to `https://www.myliftcrew.com` and allow the exact redirect `https://www.myliftcrew.com/operators.html`. Add only deliberate preview/local URLs for testing. Confirmation and recovery templates must retain the supported confirmation link. Test confirmation, resend and password recovery from an actual authorized inbox.
3. The verified hosting-project owner's email has been added to the **private** reviewer allowlist. That owner must create and confirm their account. Additional reviewers must be granted explicitly by a Supabase project administrator, for example:

   ```sql
   insert into private.operator_reviewers(user_id)
   select id from auth.users
   where lower(email) = lower('YOUR_VERIFIED_REVIEWER_EMAIL')
     and email_confirmed_at is not null
   on conflict do nothing;
   ```

4. Complete LiftCrew's legal entity, notices/contact details and commercial choices with counsel and the insurance broker. Execute the final provider agreement outside this draft-acknowledgement flow, then upload the signed copy during review. A new finalized web agreement requires a new immutable version/hash and matching database migration; never silently change a version already acknowledged.
5. Enable [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) where available; the project security advisor currently reports it disabled.
6. Define retention/deletion handling, reviewer operating procedures and a malware scanning process appropriate to your document handling. Tax documents are private but can contain sensitive tax identifiers; do not forward them to clients.

Authenticated applicants may save incomplete drafts. Submission requires full coverage records and supporting files; exceptions are disclosed for human review and do not waive insurance requirements. Each machine and operator has a stable identifier and its own document checklist. Each assignment still requires a work order and current job-specific safety/insurance review.

### Verification

`npm run build` and `node --test tests/*.test.mjs`. Integration verification uses disposable, clearly labeled accounts and synthetic files; do not use customer records as fixtures. Verify cross-account reads, anonymous reads, forged reviewer roles, direct status mutation, missing documents, expired qualifications, immutable submissions, signed-contract approval gates and retention of prior uploads. No integration credentials are committed.

Reference: [OSHA powered industrial trucks, 29 CFR 1910.178](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.178); [Supabase SMTP configuration](https://supabase.com/docs/guides/auth/auth-smtp).
