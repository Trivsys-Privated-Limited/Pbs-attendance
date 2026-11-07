-- PBS Attend — LOCAL seed data (applied by `supabase db reset` on the local stack only).
--
-- Only the initial office configuration is seeded. No employees or auth users are
-- created here: accounts must be created through Supabase Auth so passwords are
-- hashed by Auth and never stored in plain text.

insert into public.office_settings (
  company_name,
  timezone,
  shift_start,
  late_threshold,
  idle_detection_seconds,
  heartbeat_interval_seconds,
  offline_threshold_seconds
) values (
  'PBS Digitals',
  'Asia/Karachi',
  '21:00',
  '21:15',
  60,
  30,
  90
)
on conflict (id) do nothing;
