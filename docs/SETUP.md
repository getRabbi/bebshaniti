# Development and repository setup

## 1. Clone and configuration

Copy every tracked `.env.example` to its ignored runtime equivalent. Replace placeholders with values printed by `supabase status` for local development. Never copy a hosted production service-role key into a frontend file or `NEXT_PUBLIC_*` variable.

## 2. Supabase

Install Docker Desktop and Supabase CLI, then run:

```powershell
supabase start
supabase db reset
supabase status
```

`db reset` replays every migration and the local-only, intentionally empty seed. See `SUPABASE_SETUP.md` before linking a hosted project.

## 3. API

```powershell
python -m venv apps/api/.venv
apps/api/.venv/Scripts/pip install -e "apps/api[dev]"
apps/api/.venv/Scripts/uvicorn app.main:app --app-dir apps/api --reload
```

Open `http://localhost:8000/api/v1/health`. API docs are available at `/docs` outside production.

## 4. Web applications

```powershell
npm install
npm run dev:admin
npm run dev:landing
```

Admin runs on port 3000 and landing on 3001. The root npm lockfile must be committed after dependency resolution.

## 5. Flutter

The repository includes the Dart application foundation. If native platform directories are absent in a fresh checkout, generate them once with the project-pinned Flutter stable version and review all generated files before commit:

```powershell
Set-Location apps/pos_flutter
flutter create --platforms=android,ios --project-name bd_business_os_pos .
flutter pub get
flutter analyze
flutter test
```

Supply config using `--dart-define`; service-role and database secrets are prohibited.

## 6. Branch strategy

- `main` is always releasable and protected.
- Use short-lived `feature/<scope>` and `fix/<scope>` branches.
- Require migration review when `supabase/migrations/**` changes.
- Squash or rebase merge; use conventional, descriptive commit subjects.
- Preview deployments use a staging Supabase project, never production credentials.

## 7. Definition of done

Run API lint/tests, both Next builds, Flutter analyze/tests and a clean `supabase db reset`. Confirm no secret is staged with `git diff --cached` and the secret-check script.
