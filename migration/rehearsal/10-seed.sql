-- Rehearsal data for the Supabase → PostgreSQL import, written against the
-- OLD schema (supabase/migrations). It covers the cases the importer must
-- handle, not volume:
--   * e-mail/password users (bcrypt, as Supabase stores them), a Google-only
--     user, an unconfirmed user, an admin and a store account
--   * an external (Google) avatar and a
--     Storage avatar
--   * listings in old top categories and in an admin-added category (id 10),
--     with legacy `details`, every status, a long reject reason
--   * images in Storage, one missing file and one corrupt file
--   * conversations with meeting confirmations and a deleted participant,
--     messages, ratings, reports, sanctions with a too-short reason,
--     verification requests, notifications, announcements, support tickets
-- Passwords: every rehearsal account uses 'rehearsal-pass-1'. Fake data only.
set session_replication_role = replica;

insert into auth.users (id, email, encrypted_password, email_confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-4000-a000-000000000001', 'admin@rehearsal.test', crypt('rehearsal-pass-1', gen_salt('bf', 10)), '2025-01-02', '2026-09-20', '{"provider":"email","providers":["email"]}', '{}', '2025-01-01', '2026-09-20'),
  ('00000000-0000-4000-a000-000000000002', 'Satici.Bir@Rehearsal.test', crypt('rehearsal-pass-1', gen_salt('bf', 10)), '2025-02-02', '2026-09-21', '{"provider":"email","providers":["email"]}', '{}', '2025-02-01', '2026-09-21'),
  ('00000000-0000-4000-a000-000000000003', 'google.user@rehearsal.test', null, '2025-03-01', '2026-09-22', '{"provider":"google","providers":["google"]}', '{"full_name":"Gugıl Kullanıcı"}', '2025-03-01', '2026-09-22'),
  ('00000000-0000-4000-a000-000000000004', 'unconfirmed@rehearsal.test', crypt('rehearsal-pass-1', gen_salt('bf', 10)), null, null, '{"provider":"email"}', '{}', '2026-09-01', '2026-09-01'),
  ('00000000-0000-4000-a000-000000000005', 'magaza@rehearsal.test', crypt('rehearsal-pass-1', gen_salt('bf', 10)), '2025-04-01', '2026-09-23', '{"provider":"email"}', '{}', '2025-04-01', '2026-09-23'),
  ('00000000-0000-4000-a000-000000000006', 'both@rehearsal.test', crypt('rehearsal-pass-1', gen_salt('bf', 10)), '2025-05-01', '2026-09-24', '{"provider":"email","providers":["email","google"]}', '{}', '2025-05-01', '2026-09-24');

insert into auth.identities (provider_id, user_id, identity_data, provider, created_at) values
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000002', '{"sub":"00000000-0000-4000-a000-000000000002","email":"satici.bir@rehearsal.test"}', 'email', '2025-02-01'),
  ('109876543210987654321', '00000000-0000-4000-a000-000000000003', '{"sub":"109876543210987654321","email":"google.user@rehearsal.test","email_verified":true}', 'google', '2025-03-01'),
  ('109876543210987654322', '00000000-0000-4000-a000-000000000006', '{"sub":"109876543210987654322","email":"both@rehearsal.test"}', 'google', '2025-06-01');

insert into profiles (id, display_name, avatar_url, region, bio, role, status, status_until, phone_verified, settings, created_at, account_type, store_name, store_verified, store_address, store_phone, store_website, store_hours) values
  ('00000000-0000-4000-a000-000000000001', 'Yönetici', null, 'Lefkoşa', null, 'admin', 'active', null, true, '{}', '2025-01-01', 'personal', null, false, null, null, null, null),
  ('00000000-0000-4000-a000-000000000002', 'Ayşe Satıcı', '00000000-0000-4000-a000-000000000002/avatar.jpg', 'Girne', 'Temiz eşyalar.', 'user', 'warned', null, true, '{"notify_email":true}', '2025-02-01', 'personal', null, false, null, null, null, null),
  ('00000000-0000-4000-a000-000000000003', 'Gugıl Kullanıcı', 'https://lh3.googleusercontent.com/a/rehearsal-avatar', null, null, 'user', 'active', null, false, '{}', '2025-03-01', 'personal', null, false, null, null, null, null),
  ('00000000-0000-4000-a000-000000000004', 'Askıda Hesap', null, null, null, 'user', 'suspended', '2027-01-01', false, '{}', '2026-09-01', 'personal', null, false, null, null, null, null),
  ('00000000-0000-4000-a000-000000000005', 'Mağaza Sahibi', null, 'Gazimağusa', null, 'user', 'active', null, true, '{}', '2025-04-01', 'store', 'Örnek Mağaza', true, 'Salamis Yolu 1', '+905331234567', 'https://ornek.example', '09:00–18:00'),
  ('00000000-0000-4000-a000-000000000006', 'İki Yollu', null, 'Larnaka', null, 'user', 'active', null, false, '{}', '2025-05-01', 'personal', null, false, null, null, null, null);

insert into profile_private (id, email, phone, whatsapp_enabled) values
  ('00000000-0000-4000-a000-000000000001', 'admin@rehearsal.test', null, false),
  ('00000000-0000-4000-a000-000000000002', 'satici.bir@rehearsal.test', '+905339876543', true),
  ('00000000-0000-4000-a000-000000000003', 'google.user@rehearsal.test', null, false),
  ('00000000-0000-4000-a000-000000000004', 'unconfirmed@rehearsal.test', null, false),
  ('00000000-0000-4000-a000-000000000005', 'magaza@rehearsal.test', '+905331234567', true),
  ('00000000-0000-4000-a000-000000000006', 'both@rehearsal.test', null, false);

-- Admin-added categories in the old project: one new slug, one that clashes
-- with a category the new taxonomy also has.
insert into categories (id, slug, name, icon, sort_order, created_at) values
  (10, 'koleksiyon', 'Koleksiyon', 'star', 10, '2025-06-01'),
  (11, 'alet-bahce', 'Alet ve Bahçe', 'tool', 11, '2025-06-02');
do $$ begin perform setval('categories_id_seq', 11); end $$;

insert into listings (id, ref_no, slug, seller_id, category_id, title, description, price, currency, city, district, condition, negotiable, status, reject_reason, featured, view_count, published_at, created_at, updated_at, details) values
  ('10000000-0000-4000-a000-000000000001', 100001, 'ikea-koltuk-100001', '00000000-0000-4000-a000-000000000002', 1, 'IKEA üçlü koltuk', 'Temiz, evcil hayvansız evden.', 4500, 'TL', 'Girne', 'Karaoğlanoğlu', 'Az kullanılmış', true, 'active', null, true, 57, '2026-08-01', '2026-08-01', '2026-08-02',
    '{"brand":"IKEA","model":"Kivik","color":"Gri","year":2022,"invoice":true,"box":false,"exchange":false,"delivery":["Elden teslim","Adrese teslim"]}'),
  ('10000000-0000-4000-a000-000000000002', 100002, 'iphone-13-100002', '00000000-0000-4000-a000-000000000002', 2, 'iPhone 13 128 GB', 'Pil sağlığı %88.', 21000, 'TL', 'Lefkoşa', null, 'Az kullanılmış', false, 'sold', null, false, 210, '2026-07-01', '2026-07-01', '2026-07-15',
    '{"brand":"Apple","model":"iPhone 13","warranty":"Garantisi yok"}'),
  ('10000000-0000-4000-a000-000000000003', 100003, 'eski-para-koleksiyonu-100003', '00000000-0000-4000-a000-000000000005', 10, 'Eski para koleksiyonu', 'Kıbrıs paraları, 40 adet.', 300, '€', 'Gazimağusa', null, 'Yıpranmış', true, 'active', null, false, 12, '2026-09-01', '2026-09-01', '2026-09-01', '{}'),
  ('10000000-0000-4000-a000-000000000004', 100004, 'cim-bicme-100004', '00000000-0000-4000-a000-000000000005', 11, 'Çim biçme makinesi', 'Benzinli.', 150, '€', 'Larnaka', null, 'Az kullanılmış', false, 'pending', null, false, 0, null, '2026-09-25', '2026-09-25', '{"brand":"Bosch"}'),
  ('10000000-0000-4000-a000-000000000005', 100005, 'reddedilen-100005', '00000000-0000-4000-a000-000000000003', 3, 'Reddedilen ilan başlığı', 'Kurallara aykırı.', 10, 'TL', 'İskele', null, 'Sıfır', false, 'rejected', repeat('Uzun gerekçe. ', 60), false, 3, null, '2026-09-10', '2026-09-11', '{}'),
  ('10000000-0000-4000-a000-000000000006', 100006, 'taslak-100006', '00000000-0000-4000-a000-000000000006', 7, 'Bisiklet taslağı', '', 0, 'TL', 'Baf', null, 'Sıfır', false, 'draft', null, false, 0, null, '2026-09-20', '2026-09-20', '{}'),
  ('10000000-0000-4000-a000-000000000007', 100007, 'kaldirilan-100007', '00000000-0000-4000-a000-000000000002', 8, 'Roman seti', 'Kaldırıldı.', 200, 'TL', 'Güzelyurt', null, 'Yıpranmış', true, 'removed', null, false, 8, '2026-06-01', '2026-06-01', '2026-06-20', '{}');

insert into listing_images (id, listing_id, path, position, created_at) values
  ('20000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002/koltuk-1.jpg', 0, '2026-08-01'),
  ('20000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002/koltuk-2.png', 1, '2026-08-01'),
  ('20000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000002/iphone.webp', 0, '2026-07-01'),
  ('20000000-0000-4000-a000-000000000004', '10000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000005/para.jpg', 0, '2026-09-01'),
  ('20000000-0000-4000-a000-000000000005', '10000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000005/kayip.jpg', 1, '2026-09-01'),
  ('20000000-0000-4000-a000-000000000006', '10000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000005/bozuk.jpg', 0, '2026-09-25'),
  ('20000000-0000-4000-a000-000000000007', '10000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000005/cim.jpg', 1, '2026-09-25');

insert into favorites (user_id, listing_id, created_at) values
  ('00000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-000000000001', '2026-08-03'),
  ('00000000-0000-4000-a000-000000000006', '10000000-0000-4000-a000-000000000001', '2026-08-04'),
  ('00000000-0000-4000-a000-000000000006', '10000000-0000-4000-a000-000000000003', '2026-09-02');

insert into blocks (blocker_id, blocked_id, created_at) values
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000004', '2026-09-02');

insert into conversations (id, listing_id, buyer_id, seller_id, meeting_confirmed_at, last_message_at, created_at, buyer_confirmed_at, seller_confirmed_at) values
  ('30000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000006', '00000000-0000-4000-a000-000000000002', '2026-07-10', '2026-07-10 12:00', '2026-07-02', '2026-07-09', '2026-07-10'),
  ('30000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000002', null, '2026-08-05 09:30', '2026-08-05', null, null),
  -- the buyer deleted their account (0012: buyer_id becomes NULL)
  ('30000000-0000-4000-a000-000000000003', null, null, '00000000-0000-4000-a000-000000000005', null, '2026-06-01', '2026-06-01', null, null);

insert into messages (id, conversation_id, sender_id, body, read_at, created_at) values
  ('40000000-0000-4000-a000-000000000001', '30000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000006', 'Merhaba, hâlâ satılık mı?', '2026-07-02 10:05', '2026-07-02 10:00'),
  ('40000000-0000-4000-a000-000000000002', '30000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', 'Evet, yarın görüşebiliriz.', '2026-07-02 11:00', '2026-07-02 10:30'),
  ('40000000-0000-4000-a000-000000000003', '30000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003', 'Fiyatta pazarlık olur mu?', null, '2026-08-05 09:30'),
  ('40000000-0000-4000-a000-000000000004', '30000000-0000-4000-a000-000000000003', null, 'Silinmiş kullanıcının mesajı', '2026-06-01 10:00', '2026-06-01 09:00');

insert into ratings (id, rater_id, ratee_id, conversation_id, listing_id, score, comment, created_at) values
  ('50000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000006', '00000000-0000-4000-a000-000000000002', '30000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000002', 5, 'Çok ilgili satıcı.', '2026-07-11'),
  ('50000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000006', '30000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000002', 4, null, '2026-07-12');

insert into reports (id, reporter_id, listing_id, reported_user_id, reason, detail, status, resolution_note, resolved_at, created_at, target_snapshot) values
  ('60000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000003', 'Yasaklı ürün', 'Şüpheli ilan', 'resolved', repeat('Not. ', 250), '2026-09-12', '2026-09-11', '{"title":"Reddedilen ilan başlığı"}'),
  ('60000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000002', null, '00000000-0000-4000-a000-000000000004', 'Dolandırıcılık', null, 'pending', null, null, '2026-09-02', '{}');

insert into sanctions (id, user_id, kind, reason, expires_at, created_by, created_at, subject_user_id, subject_name) values
  ('70000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', 'warn', 'spam', null, '00000000-0000-4000-a000-000000000001', '2026-08-20', '00000000-0000-4000-a000-000000000002', 'Ayşe Satıcı'),
  ('70000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000004', 'suspend', 'Dolandırıcılık girişimi', '2027-01-01', '00000000-0000-4000-a000-000000000001', '2026-09-03', '00000000-0000-4000-a000-000000000004', '');

insert into verification_requests (id, user_id, kind, detail, status, resolved_at, created_at) values
  ('80000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000005', 'phone', '+905331234567', 'approved', '2025-04-03', '2025-04-02');

insert into notifications (id, user_id, kind, title, body, link, read_at, created_at) values
  ('90000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', 'listing', 'İlanın yayında', 'IKEA üçlü koltuk yayınlandı.', '/ilan/ikea-koltuk-100001', '2026-08-01 12:00', '2026-08-01'),
  ('90000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003', 'system', 'İlanın reddedildi', null, null, null, '2026-09-11');

insert into announcements (id, audience, title, body, recipients, created_by, created_at) values
  ('a0000000-0000-4000-a000-000000000001', 'all', 'Hoş geldiniz', 'Yeni özellikler yolda.', 6, '00000000-0000-4000-a000-000000000001', '2026-05-01');

insert into support_tickets (id, user_id, email, topic, message, status, created_at) values
  ('b0000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', 'satici.bir@rehearsal.test', 'Hesap', 'Şifremi değiştiremiyorum.', 'closed', '2026-08-10'),
  ('b0000000-0000-4000-a000-000000000002', null, 'ziyaretci@rehearsal.test', 'Diğer', 'Reklam vermek istiyorum.', 'open', '2026-09-28');

insert into rate_limit_events (user_id, action, created_at) values
  ('00000000-0000-4000-a000-000000000002', 'listing_create', now());

set session_replication_role = origin;
