# Daily practice cutover

1. In Supabase, enable **Authentication → Providers → Google** and add these redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://achievers-cat-web.vercel.app/auth/callback`
2. Your existing full schema has already been run. Open **SQL Editor** and run only `migrations/20260909_daily_practice_existing_schema.sql`.
3. After signing in once, run the final `update public.profiles ...` statement from that migration with your own email to make yourself an admin.
4. Copy every existing Firestore `daily_packages/{YYYY-MM-DD}` document into the new table. Keep `quant`, `varc`, and `dilr` in their respective JSON columns.

```sql
insert into public.daily_packages (id, date, published, quant, varc, dilr)
values (
  '2026-09-09',
  '2026-09-09',
  true,
  '[]'::jsonb,
  '{"type":"VA", "questions": []}'::jsonb,
  '{"questions": []}'::jsonb
)
on conflict (date) do update set
  published = excluded.published,
  quant = excluded.quant,
  varc = excluded.varc,
  dilr = excluded.dilr,
  updated_at = now();
```

Use the original Firestore document ID for `id` (normally the same date string).
