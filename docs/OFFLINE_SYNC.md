# Offline sync boundary

Phase 0 reserves `devices`, `sync_events`, `outbox_events` and Flutter local DB/sync modules. No fake in-memory sync is included.

Phase 6 will persist local mutations before network calls, assign globally unique client event IDs, enforce server idempotency, paginate by server version, and treat completed sales as immutable events. Stock and due changes will be derived from server-posted movements/ledgers. Conflicts in editable catalog records will retain audit history; completed financial records will use compensation, never last-write-wins.
