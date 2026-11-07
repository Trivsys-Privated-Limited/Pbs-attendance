-- Admin Overview reads a limited employee sign-in/sign-out feed through the
-- server-side service role after the caller passes the audit.read permission check.
grant select on public.audit_logs to service_role;
