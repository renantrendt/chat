# Supabase Cron Job Setup

To automatically mark inactive users, you need to set up a cron job in Supabase:

1. Go to your Supabase Dashboard
2. Navigate to "Database" → "Extensions"
3. Enable the `pg_cron` extension if not already enabled
4. Go to "SQL Editor" and run:

```sql
-- Schedule the cleanup job to run every minute
SELECT cron.schedule(
    'cleanup-inactive-users',
    '* * * * *', -- Every minute
    'SELECT mark_inactive_users();'
);
```

To verify it's working:
```sql
SELECT * FROM cron.job;
```

To remove the job later if needed:
```sql
SELECT cron.unschedule('cleanup-inactive-users');
``` 