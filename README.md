# Bangladesh Retail + Wholesale Business OS

Production foundation and working web release for a multi-tenant Bangladesh retail and wholesale operating system. Supabase Auth/Postgres/RLS/Storage, FastAPI, the Next.js admin and landing applications, CI, and deployment documentation are wired without fake production data. The web release includes owner registration, atomic workspace onboarding, product/customer management, audited stock adjustments, server-calculated sales, due collection and live operational summaries.

This is not yet the full product roadmap or an approval for public merchant launch. Staff/device activation, supplier purchasing, offline Flutter POS sync, licensing and the operational controls in `docs/PRODUCTION_LAUNCH_CHECKLIST.md` remain release gates.

## Repository

- `apps/api` — FastAPI business API and JWT/tenant dependencies.
- `apps/web_admin` — authenticated Next.js admin application for `app.<domain>`.
- `apps/landing` — public Next.js website for the apex domain.
- `apps/pos_flutter` — Flutter POS client with Supabase Auth and API boundaries.
- `supabase/migrations` — canonical, ordered database/RLS/storage migrations.
- `supabase/seed/local.sql` — intentionally empty local-only seed entry point.
- `docs` — architecture, security, database and deployment runbooks.
- `infra` — deployment examples and operational scripts.

## Prerequisites

- Git 2.45+
- Node.js 22+ and npm 10+
- Python 3.12+
- Docker Desktop and Supabase CLI
- Flutter 3.44.1 with Dart 3.12.1 for reproducible POS checks

## Local bootstrap

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web_admin/.env.example apps/web_admin/.env.local
Copy-Item apps/landing/.env.example apps/landing/.env.local
supabase start
supabase db reset
npm install
python -m venv apps/api/.venv
apps/api/.venv/Scripts/pip install -e "apps/api[dev]"
```

Run services in separate terminals:

```powershell
apps/api/.venv/Scripts/uvicorn app.main:app --app-dir apps/api --reload --port 8000
npm run dev:admin
npm run dev:landing
```

Flutter uses compile-time configuration, never a bundled service-role key:

```powershell
Set-Location apps/pos_flutter
flutter pub get
flutter run --dart-define=APP_ENV=local --dart-define=SUPABASE_URL=http://127.0.0.1:54321 --dart-define=SUPABASE_ANON_KEY=<local-anon-key> --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1
```

For Android Emulator, `10.0.2.2` points to the host. Physical devices need a reachable LAN/TLS endpoint.

## Validate

```powershell
Set-Location apps/api
ruff check app tests
ruff format --check app tests
pytest
pip-audit
Set-Location ../..
npm run lint
npm run typecheck
npm run build
Set-Location apps/pos_flutter
flutter analyze
flutter test
```

See [docs/SETUP.md](docs/SETUP.md), [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md), and [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md) before using a hosted environment.

## GitHub first push

Create an empty private GitHub repository, then:

```powershell
git init
git switch -c main
git add .
git commit -m "chore: establish production phase 0 foundation"
git remote add origin git@github.com:<owner>/<repository>.git
git push -u origin main
```

Protect `main`: require pull requests, at least one approval, conversation resolution, and all API/Admin/Landing/Flutter/Supabase checks. Do not allow force-push or branch deletion.

## Production rule

The Supabase service-role key and database credentials are server-only. Browsers and Flutter receive only publishable/anon credentials, backed by RLS. Production migrations are reviewed and applied through an approved deployment job or a controlled operator session—not automatically from unreviewed preview branches.
