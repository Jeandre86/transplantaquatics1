# Supabase email verification setup

The Join form uses Supabase Auth for password signup and the default confirmation link email. The signup data is stored as private metadata on the Supabase Auth user record, so no custom profile table or migration is needed for the initial test.

## Connect the local app

1. Create or open the Supabase project for Transplant Aquatics.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the project's API settings. A legacy anon key can be used as `VITE_SUPABASE_ANON_KEY`. Never put a service-role key in this frontend.
3. In Supabase **Authentication → Providers → Email**, enable email signups and email confirmations.
4. In Supabase **Authentication → URL Configuration**, set the local Site URL to `http://localhost:5173` and add `http://localhost:5173/join` and `http://localhost:5173/coach/club` to the allowed redirect URLs.
5. The Join flow expects the default **Confirm signup** confirmation link. The link returns the user to `/join`, where the confirmed session activates the account.
6. Restart the Vite server after creating `.env.local`, then submit the Join form with an email address that can receive the confirmation link.

Supabase's built-in mail server is for initial testing: it restricts recipients to authorized team addresses and has a low send limit. To test delivery to an arbitrary inbox or use this publicly, configure a custom SMTP provider under **Authentication → SMTP Settings**.

## Athlete goals table

Profile goals are stored in `public.athlete_goals` and protected with row-level security so each signed-in athlete can only read, add, or remove their own goals.

- In the Supabase dashboard, open **SQL Editor → New query**.
- Paste and run the contents of `supabase/migrations/20260929150000_create_athlete_goals.sql`.
- Refresh the app after the query succeeds. Goal changes will then appear in both the profile Goals tab and the signed-in dashboard.

## Swimmer profiles and meet results

The result submission flow stores private swimmer profiles (including date of birth) separately from public result snapshots. A parent can manage child swimmer profiles from **Profile → Account**. Submitted meet results are shown immediately as swimmer-submitted; a faster-than-record time at a World Transplant Games is marked as a record candidate pending verification.

- In the Supabase dashboard, open **SQL Editor → New query**.
- Paste and run `supabase/migrations/20260930100000_create_meet_submissions.sql`.
- Then run `supabase/migrations/20260930130000_create_club_accounts.sql` to create the clubs table required by the results and athlete directory.
- Run `supabase/migrations/20260930160000_link_swimmers_athletes_and_club_results.sql` to backfill swimmer profiles from eligible signups and connect result records to represented clubs.
- Finally run `supabase/migrations/20260930180000_create_athletes_directory.sql`. This creates the public `athletes` table, backfills it from existing swimmer profiles, and installs a sync trigger so profile changes appear in the directory. It also updates `get_public_swimmer_directory()`, which the Athletes and Countries pages use.
- Run `supabase/migrations/20260930210000_create_meet_catalog.sql` to create and seed the public transplant-games meet directory from `transplant_games_events.json`. The result form lists World Transplant Games first, then National Transplant Games. Selecting an edition links its submitted meet to the catalogue while custom meets remain available.
- `swimmer_profiles` remains the canonical profile and result foreign-key target. `athletes` is its public directory row with the same UUID, not a second swimmer identity. The migration derives age group from the private date of birth without exposing the date itself.
- The submitting account is stored separately from the swimmer who owns each result. The athlete’s country is retained, and the club represented at submission is snapshotted so moving clubs later does not rewrite earlier results.
- Club membership is a single current club on the swimmer profile. It may be left blank for ordinary meets, but a World Transplant Games result cannot be submitted until the swimmer has a club. That rule is enforced in the database as well as the form.
- Refresh the app, review swimmer details and club under **Profile → Account**, then use **Submit results** from the dashboard.
- Age group is calculated from date of birth on the meet date, or on the World Transplant Games Opening Ceremony date when the meet is marked as WTG. Date of birth stays in the private swimmer profile; public results contain only the calculated age group.
- Points are saved as a snapshot using the current points calculation and matching world-record baseline. The current records dataset only includes LCM records, so point values may be unavailable for SCM or for event/age combinations without a matching baseline.

## World records

The Records page reads `public.world_records` from Supabase. Its seed rows come from the root `wtg_records.json` file (210 records, including source metadata). To create and populate the table, run `supabase/migrations/20260930190000_create_world_records.sql` in the Supabase **SQL Editor**. Then run `supabase/migrations/20260930200000_link_world_records_to_athletes.sql` to normalize record country codes and link record holders to uniquely matching registered athletes. Countries with records are included in the country directory, and linked holders open their athlete profile. These migrations depend on the `public.athletes` table from migration `20260930180000_create_athletes_directory.sql`. The records table allows public read access only; changes are made through controlled database migrations.

The app uses the signed-in Supabase session and the public publishable key. Do not put a service-role key in the browser.

## Clubs, coach accounts, and club requests

The Join page lets someone register as a swimmer, parent/guardian, or coach. A swimmer can choose a listed club, leave it blank, or submit a new-club listing request. Coaches can open **Dashboard → Coach workspace** after confirming their email, create a public club page, and invite other coaches with a shareable invitation link.

To enable the club features in Supabase:

1. Open the Supabase **SQL Editor** and create a new query.
2. Paste and run `supabase/migrations/20260930130000_create_club_accounts.sql`.
3. Refresh the local app. Coach-created clubs will appear in the public club directory and the optional club dropdown.

Coach invitations are shareable links; this migration does not send invitation emails. The club request form stores a request for the Transplant Aquatics team to review. No staff review screen or automatic request email is included yet.

## Swimmer club invitations and coach claims

After the club tables are enabled, run `supabase/migrations/20260930170000_add_swimmer_club_claim_invites.sql`. A swimmer linked to a club can create a one-time link for a coach's email from that club's page. The invitee must create or use a confirmed coach account with the same email. The first invited coach can claim an unmanaged club; if it already has an owner, the coach joins its coaching team. The person creating the invite copies and sends the link themselves; this flow does not send email automatically.

## Account settings

The Profile **Account** tab updates email and password through Supabase Auth. Email changes use Supabase's confirmation email flow. The team-interest email preference is displayed as unavailable until varsity accounts are supported.

Account closure uses a Supabase Edge Function so the service-role key stays on the server:

1. From the project root, deploy `supabase/functions/close-account` with the Supabase CLI: `supabase functions deploy close-account`.
2. Keep JWT verification enabled for the function (the default). The function verifies the caller's session and deletes only that authenticated user's Supabase Auth account.
3. Do not add the service-role key to any `VITE_` variable or frontend file. Supabase provides it to deployed Edge Functions as a server-side secret.

The Account page asks for the current password and an explicit `CLOSE` confirmation before calling the function. Public meet results are not deleted by closing the sign-in account.

## Admin workspace and official meet results

The app includes a protected admin workspace at `/admin` for meet imports, result review/publication, swimmer profile matching, profile claims, WTG record review, roles, and an activity log. The 2027 Summer World Transplant Games (Leuven) is the first import target. The dashboard displays **Results not available yet** while no official results have been released; do not add illustrative or estimated result data.

The admin migrations are applied to the connected Supabase project. They are also tracked in `supabase/migrations/20261001010000_create_admin_import_and_claims.sql` through `20261001100000_lock_down_admin_rpc_grants.sql`. The `admin-importer` Edge Function is deployed with JWT verification enabled. When syncing migrations locally, note that Supabase assigned remote timestamps during direct MCP deployment; compare `supabase migration list` before attempting a CLI push.

To initialize access, sign in with the account that should own the admin workspace and open `/admin`. If no admin membership exists yet, choose **Set up first Owner**. The database only permits this once, only for the signed-in account, and only while the membership table is empty. After that, the Owner can grant administrator, results editor, or claim reviewer access to other accounts. Admin RPC execution is restricted to authenticated users and the functions check the assigned role and permission.

The importer currently accepts CSV and JSON v1 result files. Uploads are stored privately with source metadata and a SHA-256 digest. Re-uploading the same source is detected. Rows are staged first; reviewers must resolve swimmer identities with evidence, review each row, then publish the batch. Public performance rows are exposed only after publication. Rollback removes unchanged results published by the batch while preserving the import source and audit trail. The WTG record checker compares verified result times against current record history; only a reviewer with supporting evidence can confirm a new record, and former holders remain visible in the record history after a record is superseded.

PDF, spreadsheet parsing (XLS/XLSX), and arbitrary results-page URL extraction are not enabled yet. Those source formats should be converted to CSV or the documented JSON shape before import. No official 2027 results have been seeded, and the admin setup does not create fake accounts or results.

## Writer accounts and article publishing

The Owner/Admin workspace includes **Writers** and **Articles** sections. Administrators invite writers by email through Supabase Auth; the invite contains a secure one-time link, and the writer must choose a personal password on first access. The app does not issue or email a shared default password. Writers use `/writer` to create drafts, edit changes-requested stories, and submit completed articles. Editors can request changes, decline, or publish as a standard article or feature article. Only approved published articles appear on the public news page and homepage.

The `site_writers` and `site_articles` schema and moderation policies are in `supabase/migrations/20261001110000_writer_accounts_and_articles.sql`; writer dashboard counters are in `supabase/migrations/20261001120000_writer_dashboard_counts.sql`. These migrations have been applied to the connected project, and the JWT-protected `writer-workflow` function has been deployed. Configure Supabase **Authentication → URL Configuration** to allow the site URL ending in `/writer` so invitation confirmation can return the writer to the password setup screen.

For administrator email alerts when an article is submitted, configure the `writer-workflow` Edge Function secrets `RESEND_API_KEY` and `WRITER_NOTIFICATION_FROM` (a verified sender address). Without these secrets, submission and moderation still work, and the admin sees the article in the review queue, but email delivery is reported as not configured. The function sends review alerts to active Owner and Administrator account email addresses.
