# ProcureFlow blank-page investigation — 6 October 2026

## Assessment

No general hosting outage was identified. ProcureFlow cannot yet be excluded as a contributor: browser session handling and stale cached startup assets have concrete app-side risks. The cause of the reported blank screen remains unconfirmed without evidence from an affected browser.

The report concerns Ngoc Giang and Ashish Chhabra using https://procureflow-app-spl.azurewebsites.net/. The owner believes the failure occurred before the login screen. Read-only checks were performed; no production code, access grants, account settings, or business records were deliberately changed by this investigation.

## Verified evidence

- Azure App Service is Running. Azure Resource Health reported Available at 12:55 pm Sydney time, with the summary “The Web app is running normally.”
- Azure hosting metrics for 5 October 12:00 pm through 6 October approximately 12:55 pm Sydney time contained zero HTTP 5xx and zero HTTP 4xx responses. This does not exclude browser failures: the SPA server can return HTTP 200 HTML for nonexistent script URLs. Request-level HTTP logging is disabled, limiting historical asset-request attribution.
- Deployment run 37396420714 succeeded at 11:56:36 am Sydney time, delivering commit d75eedb. The live version endpoint identifies that commit. Ashish has successful login records before this deployment, so deployment timing alone cannot establish causation.
- The HTML, four initial JavaScript bundles, stylesheet, and external Tailwind script all returned HTTP 200. Same-origin startup assets had the expected JavaScript/CSS content types and took approximately 114–269 ms in the sampled requests. The root request took approximately 610 ms. These measurements apply to the investigating machine's connection.
- The login screen rendered in both Chrome and the separate Codex in-app browser. The reported persistent empty page was not reproduced.
- Both affected accounts are APPROVED, linked to authentication records, and have no authentication ban. Both completed successful Microsoft/Supabase sign-ins at approximately 11:56:19–20 am Sydney time. Earlier authenticated requests successfully read users, items, stock, and purchase-request data. This proves historical connectivity and authentication, not successful rendering at the reported failure time.
- Backend edge logs from 9 am–1 pm Sydney time contained no 5xx responses. There were some 401, 406, and 409 responses; the affected users' 406 responses concerned app configuration and 409 responses concerned audit logging. These are not proof of the initial blank-page cause.

## App-side risks

1. **Session locks:** The Chrome test recorded an orphaned Supabase lock warning, user-record lookup failures, and `AbortError: Lock broken by another request with the 'steal' option`. This test shared an existing browser profile and session, so it does not establish that the affected users encountered the same condition. The source's asynchronous `onAuthStateChange` callback awaits a handler that makes Supabase database requests. Supabase documents this pattern as a potential deadlock: https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0. The in-app browser rendered the login screen without these error-level messages; it logged a safety-timeout warning, which alone does not establish a 30-second visible stall because the callback captures the initial loading state.
2. **Stale startup assets:** The service worker can fall back to cached HTML. A known older local build references `/assets/index.CJlnkEEg.js`; requesting that URL from production returned HTTP 200 with `text/html`, containing the application HTML. That response cannot execute as a JavaScript module. This demonstrates a failure mode for a stale shell whose bundle is no longer deployed. The local build is not evidence that either affected browser cached that exact bundle.
3. **External startup dependency:** The HTML synchronously loads `https://cdn.tailwindcss.com`. Site-specific filtering or a stalled connection to this origin could delay startup. This origin was reachable during the investigation, and no affected-site evidence establishes blocking.

## Next checks with affected users

1. Close all ProcureFlow tabs and open the usual URL in a private window. If it loads there while the usual profile fails, investigate cached app assets, stored session state, and browser extensions.
2. If the private window also fails, test the same browser through a mobile hotspot. Success on the hotspot with failure on the site connection points toward the site's network/proxy/filtering path.
3. If both fail, capture the browser Console errors and the failed or pending script requests in Network, including status and content type. Capture the time and whether the failure is before or after Microsoft sign-in. Keep tokens, cookies, and full authentication callback URLs out of shared evidence.

Clearing only ProcureFlow site data is a subsequent recovery option; it signs the user out and may remove locally stored preferences or drafts. Preserve needed local work first.

No fix or release was made. User acceptance and the exact incident cause remain outstanding.
