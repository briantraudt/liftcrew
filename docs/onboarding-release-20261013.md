# Operator onboarding update

Flow: Your business → Equipment → Operators → Read & sign → Insurance → Supporting documents → Finish onboarding.

Equipment authorization is stored as stable `equipmentIds` on each operator. Removing a machine removes its selections without assigning another machine. Legacy typed descriptions are retained until the operator explicitly selects their equipment. Old numeric step bookmarks are mapped to stable step IDs.

Service coverage is calculated on the server from the business ZIP center and a positive service radius in miles. ZIPs are not selected by the applicant or inferred from ZIP number ranges. The same distance function is used for the coverage preview and reviewer matching. Matching still requires current approval, both signatures, current independently verified insurance, suitable equipment and an operator assigned to that equipment. ZIP-center estimates are not driving distances or a guarantee that every address within a ZIP is accessible. Unknown ZIPs fail explicitly.

The pinned ZIP reference is US-Zip-Codes-JSON commit a8964849d0ea3d3fa9eb18e57f20ac2cc41571f3 (2022 snapshot), used under the MIT license in docs/zip-reference-license.txt. Its Git blob hash is verified at import. It is reference data, not a current USPS deliverability database; new or missing ZIPs require review and a future reference update.

Insurance is uploaded once as `insurance_packet`; legacy insurance uploads remain usable. One file may support multiple requirements. All policy, limit, date, named-insured, endorsement, private-storage, consent, evidence-fingerprint and independent-review requirements remain. No policy can pass merely because a file was uploaded. Only the obsolete six-upload-slot presence checks are replaced by one packet-presence check.

## Hosted Supabase URL configuration (outside Git)

The app sends confirmations to https://myliftcrew.com/operator-confirmed.html. The page verifies the callback and asks the operator to log in. It does not display an email-confirmed state for an ordinary direct visit, an expired link, or an unverified callback, and it does not persist a callback session.

In project exokcxcxmmsnqejzhxwf, Authentication → URL Configuration:
- Site URL: https://myliftcrew.com
- Allow https://myliftcrew.com/operator-confirmed.html and https://myliftcrew.com/operator-confirmed
- Allow https://myliftcrew.com/operators.html for password recovery
- Add the corresponding exact www URLs only when needed; do not broadly allow arbitrary hosts.

The confirmation email template should use {{ .ConfirmationURL }} or an approved token-hash link to this callback, never a hardcoded localhost URL. These hosted settings are not changed by a Git push. Already sent localhost links cannot be repaired by the new web page; use a fresh confirmation after updating the hosted settings, or log in if the account was already confirmed.

Apply the two 20261013180000 / 20261013180100 migrations and deploy the insurance-review Edge Function including rules.mjs and rules-core.mjs with its existing custom authenticated request validation. This change does not remove the provider approval or countersignature gates.
