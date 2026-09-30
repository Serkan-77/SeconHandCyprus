-- Privileges of the runtime role (kie_app). Runs after every schema change
-- that adds objects; later migrations that add tables re-run the same grants.
--
-- kie_app gets DML on application tables (row level security decides which
-- rows), read/write on the auth tables (only the API's auth module uses them)
-- and nothing else: no DDL, no ownership, no BYPASSRLS.

grant usage on schema public, app, auth to kie_app;

grant select, insert, update, delete on all tables in schema public to kie_app;
grant usage, select on all sequences in schema public to kie_app;
grant select, insert, update, delete on all tables in schema auth to kie_app;
grant usage, select on all sequences in schema auth to kie_app;

-- Nobody but the owner may change the region list or the audit log history.
revoke insert, update, delete on public.regions from kie_app;
revoke update, delete on public.admin_audit_log from kie_app;

-- Functions: EXECUTE is granted to PUBLIC by default in PostgreSQL. Revoke it
-- for everything and grant back only what the API calls directly; triggers
-- run regardless of EXECUTE on their function.
revoke execute on all functions in schema public, app from public;
grant execute on function
  app.uid(), app.role(), app.trusted(), app.fold(text),
  public.slugify(text), public.is_admin(), public.can_act(), public.is_sanctioned(uuid),
  public.rate_limited_caller(), public.is_participant(uuid), public.is_blocked_between(uuid, uuid),
  public.conversation_other(uuid), public.wants_notification(uuid, text),
  public.increment_listing_view(uuid), public.send_announcement(text, text, text),
  public.get_listing_whatsapp(uuid), public.listing_accepts_whatsapp(uuid),
  public.delete_my_account(), public.admin_delete_user(uuid),
  public.create_listing(uuid, int, text, text, numeric, text, text, text, text, boolean, text[], jsonb),
  public.category_path(int), public.category_subtree(int)
to kie_app;

-- Future objects created by kie_owner in later migrations.
alter default privileges for role kie_owner in schema public
  grant select, insert, update, delete on tables to kie_app;
alter default privileges for role kie_owner in schema public
  grant usage, select on sequences to kie_app;
alter default privileges for role kie_owner in schema public, app
  revoke execute on functions from public;
