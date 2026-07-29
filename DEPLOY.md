# Deploying SPMetrics to production (Vercel)

You need SPMetrics on a public URL before any real site can send events to it.
Vercel is the easiest host for a Next.js app. ~10 minutes.

## 1. Push to GitHub
```bash
git init
git add .
git commit -m "SPMetrics v1: pixel + pipeline"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/spmetrics.git
git branch -M main
git push -u origin main
```
`.env.local` and `.pgdata/` are gitignored, so no secrets are pushed.

## 2. Import into Vercel
- vercel.com → **Add New… → Project** → import the repo.
- Framework preset auto-detects **Next.js**. Build command is `npm run build`
  (which also compiles the pixel via `pixel:build`). Leave defaults.

## 3. Set environment variables (Project → Settings → Environment Variables)
| Name | Value |
|---|---|
| `DATABASE_URL` | your Supabase **Session pooler** string (`...@aws-1-eu-west-2.pooler.supabase.com:5432/postgres`) |
| `NEXT_PUBLIC_COLLECTOR_ORIGIN` | your production URL, e.g. `https://spmetrics.vercel.app` (or your custom domain) |
| `COOKIE_DOMAIN` | leave blank for now (set it when you use a per-merchant subdomain) |

> `NEXT_PUBLIC_*` is read at **build time**. If you change it, redeploy.
> The region is pinned to `lhr1` (London) in `vercel.json` to sit close to Supabase `eu-west-2`.

## 4. Deploy, then migrate the (prod) database
The schema was already applied to Supabase from your machine, so you're set. For a
**fresh** production DB, run this locally with prod's `DATABASE_URL` in `.env.local`:
```bash
npm run db:migrate
```

## 5. Smoke-test production
```bash
curl -s -X POST https://YOUR-DOMAIN/api/collect -H "Content-Type: application/json" \
  -d '{"token":"pk_dev_demo","landingPage":"https://x.com/?fbclid=1","events":[{"type":"page_view"}]}'
```
Expect `{"ok":true,...}`. Then check the `events` table in Supabase.

## 6. Lock things down before real traffic
- Set `NODE_ENV=production` (Vercel does this automatically) — the `/api/debug/stats`
  endpoint disables itself in production.
- Give each real site a restrictive `--origins` list when you run `site:create`.
- Rotate the Supabase DB password (it was shared in chat during setup).

## Custom / first-party domain (recommended)
Add a domain in Vercel (e.g. `metrics.yourbrand.com`) and set
`NEXT_PUBLIC_COLLECTOR_ORIGIN` to it. For **per-merchant** first-party tracking,
see the CNAME approach in [INSTALL.md](INSTALL.md).
