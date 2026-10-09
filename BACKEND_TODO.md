# Backend follow-up

## Displayed data-quality issues

- **Athlete/swimmer display name:** A legacy/imported profile value `Great Britain &` is an obvious non-person value. The frontend leaves it unchanged rather than guessing a correction. Review the source/import record and repair it in the data-maintenance workflow.

## Deferred until the API supports them

- **Rows per page:** Current list loading functions do not accept a page-size argument. Do not expose a rows-per-page selector until the relevant endpoint/query accepts and honors a page size.

## Admin console — Phase 5 gaps

- **Club administration:** No admin list/review/update endpoint is available for pending and approved clubs. The Clubs navigation item is hidden until that workflow exists.
- **Site settings:** No documented admin settings keys or save endpoint are available. Keep the section read-only and do not invent settings keys.
- **Overview counts:** `admin_dashboard_counts()` does not return new accounts for the last 7 days or a data-quality issue count. The overview shows an em dash for these until supported counts are added server-side.
- **Result review batches:** The current APIs list import batches and staged rows, but do not expose batch-level verification with sample swims and flagged-item summaries. The UI opens batches for existing row-level review; a bulk verification endpoint is not added here.
- **Rejection reason:** The existing result review RPC accepts a note, but there is no server-side reason enum/validation. The UI sends the selected reason in that existing note field; persist a structured reason only when the backend contract supports it.
- **Submission comparison and evidence:** The current public/admin result data does not provide an official-time comparison and evidence-link field for every swimmer submission. The review UI does not infer those values.
- **Data-quality result checks:** Non-standard stored time formats and missing result age groups need result-level admin data and a supported read path. The current client-side data-quality view only flags name and country issues from profiles already loaded.
- **Team invitations:** The existing writer invitation workflow does not invite a member with an admin role. Add a separate supported admin invitation endpoint before exposing the Phase 5 team-member invite flow.
- **Audit export and grouping:** The existing audit data supports a recent activity list, but no tested grouping metadata or export API exists. A CSV export can be client-side only after the complete audit list is available; the current page is paginated by the server's 100-row query limit.
- **Record candidate decline:** The current admin API exposes confirmation but no decline action for record candidates. Do not mark a candidate declined until a supported endpoint exists.
- **Import match confidence:** The current import matching response does not expose a documented match-confidence value. Continue to skip automated matching decisions and use the existing manual resolution flow.
- **Backup timestamp:** No admin-readable backup status/timestamp is available. The overview labels this value as not reported.
