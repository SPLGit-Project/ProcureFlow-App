# Production migrations and deployment

The production project is `yasosgkznoxamysutxfc`. On 7 October 2026 the 99
executed migration files were recovered with Supabase CLI 2.120.0:

```sh
supabase migration fetch --project-ref yasosgkznoxamysutxfc --workdir <temporary-directory> --yes
```

`migrations/` now matches the versions, filenames and SQL recorded by production,
through `20261006053009_feature_update_media_access.sql`. No production history
rows were removed or marked applied, and no historical SQL was replayed.
`migration-history.json` records the recovered files and normalized SHA-256 hashes.
The workflow verifies this baseline, previews pending migrations, applies only new
migrations, sets the existing Azure credentials, and deploys `azure-db-proxy`.
It retains JWT verification and checks that an anonymous request returns 401.

The 83 former repository scripts are preserved under
`migrations-archive/2026-10-07/`. Their timestamps and contents did not consistently
match production's history. Some were applied manually, superseded or development
scripts; being archived does not assert that every original script was deployed.
The CLI never reads this archive during deployment. Do not copy these scripts back
into `migrations/` or use `--include-all` to replay them against production.

For changes after this repair, create a new migration with `supabase migration new
<name>`, review it, and run:

```sh
node scripts/verify_supabase_migrations.mjs
node --test tests/deployment/supabase-migrations.test.mjs
supabase db push --linked --dry-run --skip-vault
```

Never edit an applied migration to ship a fix: create a later migration instead.
The local contract detects changed, missing, duplicate or backdated versions; the
linked dry run detects drift introduced outside the repository. Unexpected remote
history needs deliberate reconciliation, not automatic `migration repair` in CI.

This recovery is the historical deployment ledger for the existing production
project, not a tested clean-install baseline. Older recorded SQL contains legacy
QA fixtures and policies, and manual schema changes are not necessarily captured
in the ledger. Provisioning a new environment needs a reviewed current-schema
baseline with appropriate seed data, not blind replay of either historical folder.
