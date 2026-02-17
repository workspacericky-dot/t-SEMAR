-- ============================================
-- eSEMAR v2 — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create Custom Types (Enums)
-- ============================================
CREATE TYPE public.audit_item_status AS ENUM (
  'DRAFTING',
  'PUBLISHED_TO_AUDITEE',
  'DISPUTED',
  'FINAL_AGREED',
  'FINAL_ALTERED',
  'FINAL_ORIGINAL'
);

CREATE TYPE public.user_role AS ENUM (
  'superadmin',
  'auditor',
  'auditee'
);

-- 2. Profiles Table (extends auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role public.user_role NOT NULL DEFAULT 'auditee',
  satker_name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Superadmins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Superadmins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Superadmins can delete profiles"
  ON public.profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- 3. Audits Table (Audit sessions)
-- ============================================
CREATE TABLE public.audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  auditor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  auditee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;

-- Audits RLS Policies
CREATE POLICY "Superadmins can do everything with audits"
  ON public.audits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Auditors can view assigned audits"
  ON public.audits FOR SELECT
  USING (auditor_id = auth.uid());

CREATE POLICY "Auditees can view assigned audits"
  ON public.audits FOR SELECT
  USING (auditee_id = auth.uid());

-- 4. Audit Items Table (Individual criteria rows)
-- ============================================
CREATE TABLE public.audit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  
  -- Hierarchy
  category TEXT NOT NULL DEFAULT '',
  subcategory TEXT NOT NULL DEFAULT '',
  criteria TEXT NOT NULL DEFAULT '',
  
  -- Weights
  bobot NUMERIC(5,2) NOT NULL DEFAULT 0,
  category_bobot NUMERIC(5,2) DEFAULT 0,
  subcategory_bobot NUMERIC(5,2) DEFAULT 0,

  -- Legacy fields (optional, kept for compatibility if needed)
  no TEXT DEFAULT '',
  komponen TEXT DEFAULT '',

  jawaban_auditee TEXT DEFAULT '',
  nilai_auditee NUMERIC(10,2) DEFAULT 0,
  jawaban_evaluator TEXT DEFAULT '',
  nilai_evaluator NUMERIC(10,2) DEFAULT 0,
  catatan TEXT DEFAULT '',
  rekomendasi TEXT DEFAULT '',
  status public.audit_item_status NOT NULL DEFAULT 'DRAFTING',
  auditee_response TEXT DEFAULT '',
  auditee_action_plan TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_items ENABLE ROW LEVEL SECURITY;

-- Audit Items RLS Policies
CREATE POLICY "Superadmins can do everything with audit_items"
  ON public.audit_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

CREATE POLICY "Auditors can view items of assigned audits"
  ON public.audit_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.audits
      WHERE audits.id = audit_items.audit_id AND audits.auditor_id = auth.uid()
    )
  );

CREATE POLICY "Auditors can update items of assigned audits"
  ON public.audit_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.audits
      WHERE audits.id = audit_items.audit_id AND audits.auditor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.audits
      WHERE audits.id = audit_items.audit_id AND audits.auditor_id = auth.uid()
    )
  );

CREATE POLICY "Auditees can view items of assigned audits"
  ON public.audit_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.audits
      WHERE audits.id = audit_items.audit_id AND audits.auditee_id = auth.uid()
    )
  );

CREATE POLICY "Auditees can update own fields on assigned items"
  ON public.audit_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.audits
      WHERE audits.id = audit_items.audit_id AND audits.auditee_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.audits
      WHERE audits.id = audit_items.audit_id AND audits.auditee_id = auth.uid()
    )
  );

-- 5. Auto-create profile on signup
-- ============================================
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
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'auditee')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Updated_at auto-update trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_audits_updated_at
  BEFORE UPDATE ON public.audits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_audit_items_updated_at
  BEFORE UPDATE ON public.audit_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 7. Seed data: sample audit items template  
-- ============================================
-- (Will be inserted when an audit is created via the app)
