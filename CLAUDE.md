
<!-- SPL-PORTFOLIO-TRACKER v2 -->
## SPL portfolio logging

This project is tracked as "ProcureFlow" in the SPL Portfolio Tracker.
When you complete significant work here (a fix, a release, a milestone, a new risk),
log it back through the live SPL Portfolio Tracker report:

1. Open `https://spl-portfolio-tracker.azurewebsites.net/` and use the authenticated Admin direct-write workflow.
2. Add or update the relevant project milestone/change and status there. The report commits the central register change and redeploys automatically.
3. Verify the applied change appears in the live project page before reporting completion.

Do not edit the local tracker JSON or rebuild/redeploy a local tracker copy as the
normal workflow. Use the local fallback only when the live report is unavailable and
the user explicitly authorises it. If you do fall back, the accurate steps are:

- Entries go in the current month's file under
  "C:\Users\Aaron.bell\Documents\Claude\Projects\SPL A.I Projects\tracker\data\activity\"
  (e.g. `2026-08.json`; create it containing `[]` for a new month), newest first.
  Schema: tracker\data\SCHEMA.md; set `projects` to the tracked name above. Item
  status lives in tracker\data\items.json.
- Run `python tracker/build.py` to validate -- an out-of-vocabulary value fails the
  build loudly. Then commit `tracker/data` and push to `main`; the push triggers
  .github/workflows/deploy.yml, which rebuilds the page and deploys it to Azure.
- Never commit tracker\tracker.html: it is a gitignored build artifact that CI
  rebuilds, so a locally built copy is never what gets deployed.
- Never publish to the artifact URL in tracker\ARTIFACT_URL.txt. That artifact was
  frozen on 2026-08-04 when the tracker moved to Azure.
<!-- /SPL-PORTFOLIO-TRACKER -->
