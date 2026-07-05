# Vercel deployment

Create two Vercel projects from the same GitHub repository.

## Admin project

- Root Directory: `apps/web_admin`
- Framework: Next.js
- Production branch: `main`
- Domain: `app.yourdomain.com`
- Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL`

## Landing project

- Root Directory: `apps/landing`
- Framework: Next.js
- Production branch: `main`
- Domain: `yourdomain.com` and optionally `www.yourdomain.com`
- Variables: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`

Use Vercel's generated DNS instructions. For external DNS, add the exact A/CNAME records Vercel displays; values can change, so do not copy stale examples. Choose one canonical apex/`www` host and redirect the other. Vercel provisions TLS after DNS validation.

## Environment separation

Configure Production, Preview and Development separately. Production points only to the production Supabase/API. Preview points to staging services and must not receive production data or service-role keys. Environment changes require a new deployment.

The public Supabase anon/publishable key is safe to expose only because RLS is mandatory. Never define `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, JWT secrets or private storage signing credentials in either Vercel project.

## Deploy and verify

Git integration deploys PR previews and `main` production builds. Optional CLI flow:

```powershell
npx vercel --cwd apps/landing
npx vercel --cwd apps/landing --prod
npx vercel --cwd apps/web_admin
npx vercel --cwd apps/web_admin --prod
```

After domain binding:

1. Verify apex redirects and HTTPS.
2. Verify admin login and Supabase cookies.
3. Add the final admin URL to Supabase Auth redirects.
4. Verify browser calls target `https://api.yourdomain.com/api/v1` without mixed content.
5. Verify API CORS includes only approved admin origins.
6. Confirm preview deployments cannot access production Supabase.

The stateless FastAPI application can deploy through `apps/api/index.py` on Vercel's Python runtime. Keep Redis consumers, scheduled jobs and long-running workers on a separate worker/container platform; point the public API domain at the FastAPI deployment.
