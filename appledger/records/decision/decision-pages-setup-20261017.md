---
format_version: 0.1.0
id: decision-pages-setup-20261017
kind: decision
title: Recover missing Cloudflare Pages projects through a separate confirmation
record_status: active
created_at: 2026-10-17T19:53:31Z
updated_at: 2026-10-17T19:53:31Z
recorded_by: { id: codex, type: agent }
visibility: internal
relations: []
claims: []
data:
  status: accepted
  authority: user
  choice: Offer an account-bound Pages project creation plan from dashboard Ship,
    then require a separate Ship confirmation to deploy.
  rationale: The operator asked LocalHelm to handle a missing Pages project and
    allow creation with confirmation after ArchiveTuna's deployment failed.
  alternatives:
    - Leave missing-project errors as manual Cloudflare setup.
    - Automatically create a resource during a deployment attempt.
---

Creation is limited to statically resolved Pages targets using the site's local
Wrangler. Account, project, production branch, and directory are visible before
confirmation and revalidated before apply. Custom configurations fail closed
for creation without changing ordinary Ship behavior. Project existence is
checked again to handle races. Durable action receipts and Activity remain.

The installed Wrangler 4.151.1 delegates new Pages creation to Workers when it
detects an agent. The verified, creation-only Pages opt-out preserves the
operator's requested product. No force flag is introduced into deployment,
Git, or npm operations. This does not alter the Build phase gate.
