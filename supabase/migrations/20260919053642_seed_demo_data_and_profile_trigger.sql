/*
# Auto-create profile on signup + seed demo data

1. handle_new_user(): trigger function that inserts a profiles row for each
   new auth.users row. role defaults to 'developer' — admins are promoted
   manually (or seeded). This keeps the auth -> profile link consistent.
2. Trigger on auth.users AFTER INSERT.
3. Seed: 1 admin + 2 developers created via auth.users, with profiles.
   Passwords are set so you can log in immediately (see README for creds).
4. Sample tasks assigned to the seeded developers.

Notes:
- Seeding auth.users requires crypt() from pgcrypto (enabled by default in
  Supabase). We insert directly into auth.users with encrypted passwords so
  the accounts can be used with Supabase Auth email/password immediately.
- Email confirmation is left OFF (default).
*/

-- Trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, level)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'developer'),
    COALESCE(NEW.raw_user_meta_data->>'level', 'junior')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed auth users (idempotent-ish: we guard by email)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
SELECT
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'admin@team.dev',
  crypt('admin123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Alice Admin","role":"admin"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@team.dev');

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
SELECT
  'a0000000-0000-0000-0000-000000000002'::uuid,
  'dev1@team.dev',
  crypt('dev123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Dev One","role":"developer","level":"junior"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dev1@team.dev');

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
SELECT
  'a0000000-0000-0000-0000-000000000003'::uuid,
  'dev2@team.dev',
  crypt('dev123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Dev Two","role":"developer","level":"senior"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'dev2@team.dev');

-- Seed profiles (the trigger should create these, but ensure they exist with
-- biometric_user_id set)
INSERT INTO public.profiles (id, full_name, role, level, biometric_user_id)
VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'Alice Admin', 'admin', NULL, NULL),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'Dev One', 'developer', 'junior', '1001'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'Dev Two', 'developer', 'senior', '1002')
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  level = EXCLUDED.level,
  biometric_user_id = COALESCE(EXCLUDED.biometric_user_id, profiles.biometric_user_id);

-- Seed sample tasks (assigned by admin to developers)
INSERT INTO public.tasks (title, description, assigned_to, assigned_by, estimated_minutes, status)
VALUES
  ('Build login page', 'Implement the email/password login screen with Supabase Auth.', 'a0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 90, 'todo'),
  ('Fix attendance bug', 'Check-in time not displaying correctly on the dashboard.', 'a0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 60, 'todo'),
  ('Set up CI pipeline', 'Configure GitHub Actions for build + test on PR.', 'a0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 120, 'todo'),
  ('Write API docs', 'Document the punch edge function and bridge setup.', 'a0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 45, 'todo')
ON CONFLICT (id) DO NOTHING;
