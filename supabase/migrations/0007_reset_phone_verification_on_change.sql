-- phone_verified must describe the number currently on file (P0-07).
--
-- There is no SMS/OTP yet: phone_verified only means an admin manually
-- reviewed a number the user typed. Until now a user could have a number
-- approved and then change profile_private.phone (the "own private update"
-- policy allows it, also straight through PostgREST) while keeping the flag.
-- The app no longer shows the flag as a public badge; this makes the flag
-- itself honest: any change to the number clears it.
--
-- Duplicate numbers are NOT constrained here: phone is free text (+90533…,
-- 0533…, spaces) with no normalisation, so a UNIQUE index would miss real
-- duplicates and could block legitimate ones. That belongs with real OTP and
-- E.164 normalisation.
--
-- Safe to re-run.

-- Clears the flag whenever the stored number actually changes (same value: no-op).
-- SECURITY DEFINER so the update passes guard_profile_update, which otherwise
-- keeps phone_verified for non-admins. It is a trigger function, so it cannot
-- be called as an RPC; execute is revoked anyway.
create or replace function public.reset_phone_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update profiles set phone_verified = false where id = new.id and phone_verified;
  return null;
end $$;

revoke execute on function public.reset_phone_verification() from public, anon, authenticated;

drop trigger if exists profile_private_phone_changed on public.profile_private;
create trigger profile_private_phone_changed after update of phone on public.profile_private
  for each row when (old.phone is distinct from new.phone)
  execute function public.reset_phone_verification();

-- Admin approval of a manual phone review. Same behaviour as 0001, except the
-- number is written before the flag (so the reset above cannot undo the
-- approval) and the notification no longer calls it a verification.
create or replace function public.on_verification_resolved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status <> 'approved' and new.kind = 'phone' then
    perform set_config('app.bypass', 'on', true);
    update profile_private set phone = new.detail where id = new.user_id;
    update profiles set phone_verified = true where id = new.user_id;
  end if;
  if new.status <> old.status and new.status in ('approved', 'rejected') then
    perform notify(new.user_id, 'account',
      case when new.status = 'approved' then 'İnceleme talebin onaylandı' else 'İnceleme talebin reddedildi' end,
      case new.kind when 'phone' then 'Telefon numarası: ' else 'E-posta: ' end || new.detail,
      '/hesabim/dogrulama');
  end if;
  return new;
end $$;
