# Cloudflare Pages setup from Ship

The dashboard's **Ship** plan checks straightforward Pages deploy scripts before
running their build. When the named project is missing, **Create Pages project**
opens in the existing confirmation dialog. It shows the authenticated account
name and ID, project name, production branch, and site directory. Cancel creates
nothing. Confirm creates an empty Pages project and verifies it exists.
**Open Ship plan** then opens the ordinary, separate deployment confirmation.

A failed Ship now prioritizes the actual Wrangler error over informational
FilePress messages such as `wrote default _headers`. A single-project failure
that reports a missing Pages project offers **Review Pages setup**. That reads
current status and opens a fresh setup plan. Activity and action history retain
the failed deployment and the separate creation result.

## Supported targets

Automatic setup recognizes literal `wrangler pages deploy` / `publish` scripts
with explicit `--project-name` and `--branch`, in the root or `site/` package.
It also follows a root `pnpm --dir site [run] ship` delegation. Simple package
build commands may precede the deployment with `&&`.

The site must have an installed local Wrangler supporting JSON `whoami` and
`pages project list`. LocalHelm uses its existing sign-in. It honors the
account environment selection or Pages account cache, or the sole account in
the authenticated account list. If selection is ambiguous, set
`CLOUDFLARE_ACCOUNT_ID` for the LocalHelm server and open a new plan.

Custom wrappers, dynamic arguments, inherited Wrangler/environment files, and
other ambiguous setups continue to use their existing Ship scripts. They do
not offer automatic creation; create the intended project in Cloudflare and
retry Ship. No account, project name, or production branch is guessed from the
folder name or Git checkout.

## Confirmation and recovery

Apply re-reads enrollment, canonical site directory, manifests, local Wrangler,
account, permissions, and the remote project list. A changed target requires a
new confirmation. A project that appeared after planning is reported as already
ready without another creation. A failed or disconnected creation is never
automatically replayed: refresh the setup plan to discover its current state.

The write uses an argument array and pins the confirmed account. It never runs
the build or deployment script. Recent Wrangler versions can redirect new Pages
projects to Workers when run from an agent environment. Where the installed
implementation explicitly supports it, this creation command uses its
`--force` Pages opt-out solely to keep the requested resource on Pages. It is
never added to Ship, deploy, Git, or npm commands.

The operator-only API is `POST /api/pages-project`: `{ id, apply: false }`
returns a plan; `{ id, apply: true, revision }` requires that plan's revision.
Writes use the workspace job lock and are refused in Demo. The CLI's existing
`localhelm ship` behavior remains unchanged; this guided setup is a dashboard
feature.
