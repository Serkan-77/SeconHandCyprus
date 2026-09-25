-- Google (and other OAuth) sign-ups: take the display name and avatar from the
-- provider's metadata when the sign-up form did not supply them.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name, region, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1),
      'Kullanıcı'
    ),
    nullif(new.raw_user_meta_data ->> 'region', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  insert into profile_private (id, email, phone)
  values (new.id, new.email, coalesce(new.phone, nullif(new.raw_user_meta_data ->> 'phone', '')));
  return new;
end $$;
