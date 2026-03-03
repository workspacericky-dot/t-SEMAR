-- Fix Default Role to Auditor

-- 1. Update the table default value
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'auditor';

-- 2. Update the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'auditor')
  );
  RETURN NEW;
END;
$$;
