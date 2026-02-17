-- Add training_group column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS training_group INTEGER;

-- Allow users to insert their own profile (needed for onboarding flow if not fully automated by trigger)
-- (The trigger handle_new_user usually handles insertion, but if we need manual insertion fallback)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Storage bucket for Avatars
-- Note: You must create the 'avatars' bucket in the Supabase Dashboard first.
-- These are the policies for it.

-- 1. Public access to view avatars
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'avatars' );

-- 2. Authenticated users can upload avatars
CREATE POLICY "Anyone can upload an avatar"
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- 3. Users can update their own avatars
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING ( bucket_id = 'avatars' AND auth.uid() = owner )
  WITH CHECK ( bucket_id = 'avatars' AND auth.uid() = owner );
