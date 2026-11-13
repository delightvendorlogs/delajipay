alter table public.support_conversations
  add column if not exists last_alert_at timestamptz;
