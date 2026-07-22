# MAMINJOFX — Sales CRM

Single-page sales CRM for the MaminjoFX team (Croatian forex webinar funnel,
maminjo.com). Static `index.html` SPA + Vercel serverless functions in `/api`,
backed by GHL (leads + opportunities), Supabase (lead status, notes, activity
log), and Claude (AI lead insights/summaries/messages).

Tabs: **Leads** (pipeline) and **Metrics** (revenue + funnel + time-to-close + AI),
both computed live from GHL. Closers are internal placeholders: `closer1`
("Closer 1") and `closer2` ("Closer 2").

## Setup

1. **Supabase** — create a project and run [`supabase-schema.sql`](supabase-schema.sql)
   in the SQL editor (creates `ghl_leads`, `daily_entries`, `lead_activities` + RLS).
   Enable the **Google** auth provider and set the Site URL / redirect to the deployed
   domain. Then paste the project URL + publishable/anon key into `SUPABASE_URL` +
   `SUPABASE_KEY` near the top of `index.html` (they ship as
   `PASTE-CJURE-PROJECT-REF` / `sb_publishable_PASTE_CJURE_KEY` placeholders —
   the app will not boot until they are filled in).

2. **Vercel env vars** (Project → Settings → Environment Variables):
   - `GHL_TOKEN` — GHL Private Integration token for the CJURE location
     `K48LyDLslI2EOfXtMXSO`, scopes: **View + Edit Contacts**, **View
     Opportunities**, **Calendars** (View Calendars + View Calendar Events).
   - `ANTHROPIC_API_KEY` — for the AI insight/summary/message endpoints.

3. Deploy. Sign in with Google (any account allowed by your Supabase auth settings).

## GHL

- Location: `K48LyDLslI2EOfXtMXSO`
- Lead buckets (`api/ghl-leads.js`), from the webinar funnel tags:
  - **optin** = `maminjo-new-optin` (registered for the webinar, not yet in any
    other bucket below)
  - **qualified** = `maminjo-qualified`
  - **disqualified** = `maminjo-disqualified` / `dq`
  - **booked** = `booked-call`
  - **customer** = `customer`
- Revenue (`api/ghl-metrics.js`): opportunities — `won` = collected, `open` = pipeline.
  Deal value comes from the GHL opportunity; MaminjoFX program pricing varies per deal.


## Maminjo differences vs cjure-crm
- Kalendar reads native Supabase `bookings` (maminjo.com/rezerviraj), not a GHL calendar (`api/ghl-appointments.js` rewritten, same response shape).
- Supabase project `ydltgxzdcipvvcajjxbi`; GHL location `RKrapXXixFmKO2AnWe0B`.
- Env needed on Vercel: `GHL_TOKEN` (Maminjo PIT), `SUPABASE_SERVICE_ROLE_KEY`, `SLACK_WEBHOOK_URL` (optional), `ANTHROPIC_API_KEY` (optional AI summaries).
- `GHL_CF` custom-field map is EMPTY until the Maminjo field IDs are fetched (needs the token).
