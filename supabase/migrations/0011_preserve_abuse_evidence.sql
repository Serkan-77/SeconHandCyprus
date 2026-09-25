-- Abuse evidence outlives the listing or account it is about (P1-08).
--
-- Before: deleting a listing or an account deleted every report about it
-- (on delete cascade) and every sanction of that account, so a scammer could
-- erase the record by deleting their listing or account. Reports could also
-- be filed twice while open, against oneself, or with a forged status.
--
-- After:
--   * reports keep a snapshot of their target (listing text, price, seller,
--     photo paths; or the reported user's name) taken when filed; listing_id
--     and reported_user_id become NULL when the target is deleted instead of
--     deleting the report. Existing reports get a snapshot now.
--   * sanctions keep subject_user_id/subject_name; user_id becomes NULL when
--     the account is deleted instead of deleting the sanction.
--   * one open (pending/reviewing) report per reporter and target; no reports
--     on yourself or your own listing; new reports always start as pending;
--     only active listings can be reported by users.
--   * delete_my_account refuses while the account is restricted or suspended
--     (the appeal goes through a support ticket).
--
-- Foreign keys are dropped and re-added under the same names (the admin pages
-- embed through them). No rows are deleted. Development data was checked
-- first: no duplicate open reports, no self reports.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

alter table public.reports add column if not exists target_snapshot jsonb;

-- What a report was about, as it was when filed. Readable only through the
-- report itself (reporter or admin); not callable by clients.
create or replace function public.report_target_snapshot(p_listing uuid, p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'captured_at', now(),
    'listing', (
      select jsonb_build_object(
        'id', l.id, 'title', l.title, 'description', l.description, 'price', l.price,
        'currency', l.currency, 'city', l.city, 'district', l.district, 'status', l.status,
        'ref_no', l.ref_no, 'seller_id', l.seller_id, 'seller_name', p.display_name,
        'images', coalesce((select jsonb_agg(i.path order by i.position) from listing_images i where i.listing_id = l.id), '[]'::jsonb))
      from listings l join profiles p on p.id = l.seller_id
      where l.id = p_listing),
    'user', (
      select jsonb_build_object('id', p.id, 'display_name', p.display_name)
      from profiles p where p.id = p_user)
  ))
$$;

revoke execute on function public.report_target_snapshot(uuid, uuid) from public, anon, authenticated;

create or replace function public.guard_report_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_seller uuid;
  v_status text;
begin
  if new.listing_id is not null then
    select seller_id, status into v_seller, v_status from listings where id = new.listing_id;
  end if;
  if public.rate_limited_caller() then
    new.status := 'pending';
    new.resolution_note := null;
    new.resolved_at := null;
    if new.reported_user_id = new.reporter_id or v_seller = new.reporter_id then
      raise exception 'Kendini ya da kendi ilanını şikayet edemezsin.' using errcode = '23514';
    end if;
    if new.listing_id is not null and v_status is distinct from 'active' then
      raise exception 'Bu ilan şikayet edilemez.' using errcode = '23514';
    end if;
  end if;
  new.target_snapshot := public.report_target_snapshot(new.listing_id, new.reported_user_id);
  return new;
end $$;

revoke execute on function public.guard_report_insert() from public, anon, authenticated;

-- Runs before zz_rate_limit (name order).
drop trigger if exists reports_insert_guard on public.reports;
create trigger reports_insert_guard before insert on public.reports
  for each row execute function public.guard_report_insert();

update public.reports
  set target_snapshot = public.report_target_snapshot(listing_id, reported_user_id)
  where target_snapshot is null;

alter table public.reports
  drop constraint if exists reports_listing_id_fkey,
  add constraint reports_listing_id_fkey foreign key (listing_id) references public.listings (id) on delete set null,
  drop constraint if exists reports_reported_user_id_fkey,
  add constraint reports_reported_user_id_fkey foreign key (reported_user_id) references public.profiles (id) on delete set null,
  -- 0001's unnamed "listing or user" check would now fail when the target is
  -- deleted; the snapshot keeps the target instead.
  drop constraint if exists reports_check,
  drop constraint if exists reports_target_check,
  add constraint reports_target_check check (listing_id is not null or reported_user_id is not null or target_snapshot is not null);

create unique index if not exists reports_open_listing_uniq on public.reports (reporter_id, listing_id)
  where status <> 'resolved' and listing_id is not null;
create unique index if not exists reports_open_user_uniq on public.reports (reporter_id, reported_user_id)
  where status <> 'resolved' and listing_id is null and reported_user_id is not null;

-- ---------------------------------------------------------------------------
-- Sanctions
-- ---------------------------------------------------------------------------

alter table public.sanctions
  add column if not exists subject_user_id uuid,
  add column if not exists subject_name text;

update public.sanctions s
  set subject_user_id = s.user_id, subject_name = p.display_name
  from public.profiles p
  where p.id = s.user_id and s.subject_user_id is null;

create or replace function public.sanction_subject()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null then
    raise exception 'Yaptırım bir kullanıcıya verilmeli.' using errcode = '23502';
  end if;
  new.subject_user_id := new.user_id;
  new.subject_name := (select display_name from profiles where id = new.user_id);
  return new;
end $$;

revoke execute on function public.sanction_subject() from public, anon, authenticated;

drop trigger if exists sanctions_subject on public.sanctions;
create trigger sanctions_subject before insert on public.sanctions
  for each row execute function public.sanction_subject();

alter table public.sanctions alter column user_id drop not null;
alter table public.sanctions
  drop constraint if exists sanctions_user_id_fkey,
  add constraint sanctions_user_id_fkey foreign key (user_id) references public.profiles (id) on delete set null,
  drop constraint if exists sanctions_subject_check,
  add constraint sanctions_subject_check check (subject_user_id is not null);

create index if not exists sanctions_subject_idx on public.sanctions (subject_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Account deletion
-- ---------------------------------------------------------------------------

-- Replaces the 0001 version.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Oturum bulunamadı.'; end if;
  if public.is_sanctioned(auth.uid()) then
    raise exception 'Hesabın kısıtlıyken silinemez. İtiraz için destek talebi oluşturabilirsin.' using errcode = 'PT403';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
