# HANDOFF PROMPT — paste everything below the line into Claude Opus (Claude Code), in an empty repo

---

You are my senior engineer and I am the product owner. We are building **Pipeline of One**: a
GTM-engineering system that treats my job search as a sales pipeline. Read this whole brief,
then do the "Before you write code" step, then build in the phases listed. Work autonomously,
commit after every phase, and stop only where this brief says to ask me.

## 0. Who I am and why this exists
I'm Noah, based in Israel, repositioning into Marketing Ops / RevOps / GTM Engineering.
I know React, Supabase, Vercel, a bit of n8n and Clay. I've shipped one live product
(Afterschool Club). I'm not a senior backend engineer, so keep code readable, well commented
where non-obvious, and the architecture boring.

This project has two jobs:
1. **Daily tool**: find the best-fit GTM/RevOps/Marketing Ops roles, help me reach the right
   people with good outreach, and track everything.
2. **Portfolio piece**: a hiring manager should open the public repo/demo and think "this
   person already does the job." So the README, architecture diagram, and a public demo
   mode with fake data matter as much as the features.

## 1. Hard constraints (non-negotiable)
- **Human in the loop.** The system never sends an email, message, or application on its own.
  It drafts; I copy/approve. No auto-apply, no spam.
- **No scraping that violates terms.** No LinkedIn scraping or login automation. Use only
  public, documented endpoints: Greenhouse Job Board API, Lever Postings API, Ashby public
  job board API, Hacker News "Who is hiring" (via the Algolia HN API), and RSS where offered.
  Respect rate limits; identify with a polite User-Agent; cache responses.
- **Secrets**: never commit keys. `.env.example` only. Validate env at boot with zod.
- **Privacy**: the public demo uses seeded fake data only. My real data lives behind auth in
  my own Supabase project.
- **Budget awareness**: use Claude Haiku-class models for bulk scoring, a stronger model only
  for outreach drafts. Cache LLM results by content hash so nothing is paid for twice.
  Log token usage per run on the dashboard.

## 2. Stack (decided; don't relitigate)
- Next.js (App Router) + TypeScript (strict) + Tailwind + shadcn/ui
- Supabase (Postgres + Auth + Row Level Security), SQL migrations in `/supabase/migrations`
- Vercel for hosting and Vercel Cron for scheduled ingest
- Anthropic API via the official TypeScript SDK (check the current model IDs in the docs
  rather than assuming; make them config, not hardcoded)
- Resend for the weekly digest email
- Vitest for unit tests, Playwright for one end-to-end smoke test
- GitHub Actions: typecheck, lint, test on every PR

## 3. Core domain (model this carefully)
- `companies` (name, ats_type, ats_slug, website, size_hint, industry_hint, notes)
- `jobs` (company_id, source, external_id, title, location, remote_policy, url, posted_at,
  description_text, content_hash, first_seen_at, last_seen_at, status_open)
- `job_scores` (job_id, rubric_version, total 0-100, dimension_scores jsonb, rationale,
  model, tokens_in, tokens_out, content_hash) — cache key is job content_hash + rubric_version
- `contacts` (company_id, name, title, source, url, notes) — entered manually or via CSV
  import; no automated people-scraping
- `pipeline_items` (job_id, stage, stage_changed_at, next_action, next_action_due, notes)
  stages: `Discovered → Shortlisted → Researching → Outreach Drafted → Contacted →
  Replied → Interviewing → Offer → Closed (won/lost/ghosted)`
- `outreach_drafts` (pipeline_item_id, contact_id nullable, channel email|linkedin|referral,
  subject, body, version, status draft|approved|sent_manually, created_at)
- `profile` (my background, target roles, must-haves, dealbreakers, salary/location prefs,
  proof points) — a single editable record that feeds scoring and drafting
- `runs` (kind ingest|score|digest, started_at, finished_at, counts, tokens, errors)

## 4. Features, in build order

### Phase 1 — Foundation (commit when green)
Repo scaffold, CI, env validation, Supabase schema + RLS + migrations, auth (magic link, single
allowed email via env), seed script producing realistic **fake** demo data, and a `/demo` route
that renders the whole app read-only from the seed. Include a `README` skeleton and `docs/`.

### Phase 2 — Ingest
Connectors behind one `JobSource` interface: Greenhouse, Lever, Ashby, HN Who's Hiring.
A `companies` watchlist I can edit in the UI (paste a careers-page URL → detect ATS + slug).
Dedupe by (source, external_id) and content_hash; mark jobs closed when they disappear.
Keyword/title prefilter (configurable in profile) before anything touches an LLM.
Vercel Cron route, idempotent, with a `runs` record. Unit-test each connector against saved
fixture responses (no live network in tests).

### Phase 3 — Scoring
Rubric v1, versioned in code and stored with each score. Dimensions (weights editable):
role match, seniority fit, GTM-stack signals (Clay, n8n, HubSpot, Salesforce, Segment, etc.),
company stage/size, remote/Israel-timezone friendliness, comp/growth signals, red flags.
LLM returns strict JSON validated by zod; retry once on malformed output. Show the rationale
and per-dimension breakdown in the UI so scores are explainable, not magic. Provide a small
golden set of ~15 labeled example jobs and an eval script that reports agreement between my
labels and the model's scores — I will tune the rubric against it.

### Phase 4 — Pipeline UI
Ranked "Today" view (top new matches), job detail page, kanban for pipeline stages with
drag-and-drop, quick-add for jobs found elsewhere (paste a URL or text), stage-change history,
next-action reminders. Fast, keyboard-friendly, works on mobile. Keep the design clean and
restrained; no gradients-and-glass clichés.

### Phase 5 — Outreach assistant
For a shortlisted job: research brief (what the company does, the role's likely pain, 3
specific hooks from the job description), then 2 draft variants per channel using my profile
proof points. Voice rules: short, specific, no flattery, no "I hope this finds you well", no
buzzword soup, one clear ask. Show a diff between versions. Everything stays `draft` until I
mark it sent manually. A "referral request" template for warm contacts too.

### Phase 6 — Metrics and digest
Funnel dashboard: discovered → shortlisted → contacted → replied → interviewing, conversion
rates, time-in-stage, outreach reply rate by channel/variant, source quality (which ATS or
list yields the best matches). Weekly digest email via Resend: new top matches, items going
stale, follow-ups due, funnel numbers, spend for the week.

### Phase 7 — Portfolio polish
README with a one-paragraph pitch, an architecture diagram (Mermaid), screenshots/GIF of the
demo, "what I'd do next," and a short write-up of design decisions (why human-in-the-loop,
how scoring is evaluated, cost controls). Deploy to Vercel. Make the `/demo` route the public
landing experience and write deploy instructions for my private instance.

## 5. Definition of done
- `pnpm typecheck && pnpm lint && pnpm test` pass; CI green
- A fresh clone can run the demo with `pnpm i && pnpm seed && pnpm dev` with no API keys
- Ingest, score, and digest each run end-to-end against fixtures in tests
- No secrets in git history; `.env.example` complete
- Eval script runs and prints an agreement report
- Deployed demo URL works, and README is portfolio quality

## 6. How to work
1. **Before you write code**: restate the plan in under 25 lines, list assumptions, and flag
   any decision that needs me (e.g. Supabase project creation, API keys, Resend domain, deploy
   target). Then ask me those questions in ONE batch and proceed on defaults for the rest.
2. Use small, reviewable commits with conventional messages. One branch per phase, merged to
   `main` via PR if a remote exists, otherwise just commit.
3. Write tests alongside code, not after. Prefer fixtures over live calls.
4. After each phase, give me a 5-line status: what works, what's stubbed, what I need to do
   (keys, clicks), and the exact command to try it.
5. If something is ambiguous and low-stakes, choose the simplest option and note it in
   `docs/decisions.md`. Only stop to ask when it's expensive to reverse.
6. Don't gold-plate. If a feature isn't listed, don't add it. If you think something is
   missing, add it to `docs/next.md` instead of building it.
7. Keep token spend sensible: don't re-read huge files repeatedly, and prefer targeted edits.

Start now with the "Before you write code" step.
