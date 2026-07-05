# Production launch checklist

- [ ] Production and staging Supabase projects are separate and backed up.
- [ ] All migrations apply from an empty database and pass lint.
- [ ] Cross-organization and branch RLS tests pass.
- [ ] Supabase Auth URLs, confirmations and administrator MFA are configured.
- [ ] Service-role/database secrets exist only on API/worker hosts.
- [ ] Admin and landing Vercel production/preview variables are separated.
- [ ] Apex, admin and API domains have valid TLS and monitoring.
- [ ] API image is scanned, health checked and rollback tested.
- [ ] Error monitoring, log redaction, uptime alerting and incident ownership are active.
- [ ] Backup restore has been tested in isolation.
- [ ] Privacy/terms and Bangladesh tax/invoice behavior have professional review.
- [ ] No local seed, fake organization, development user or preview credential exists in production.
