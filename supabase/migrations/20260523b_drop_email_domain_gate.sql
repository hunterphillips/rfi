-- Remove the email-domain sign-up restriction.
--
-- The app previously hard-gated account creation to @integritypro.com via this
-- trigger on auth.users, mirrored by a UX check in the login server action
-- (now also removed). This drops the hard gate so any email can sign up / sign
-- in. The unrelated `on_auth_user_created` / `handle_new_user()` trigger that
-- mirrors new users into `public.profiles` is intentionally left in place.
--
-- Apply via Supabase dashboard SQL editor.

DROP TRIGGER IF EXISTS enforce_email_domain_before_insert ON auth.users;
DROP FUNCTION IF EXISTS public.enforce_email_domain();
