-- Migration: 01_hierarchy_update.sql
-- Run this in Supabase SQL Editor to update the audit_items table

-- 1. Add new columns for 3-level hierarchy
ALTER TABLE public.audit_items
ADD COLUMN category TEXT NOT NULL DEFAULT '',
ADD COLUMN subcategory TEXT NOT NULL DEFAULT '',
ADD COLUMN criteria TEXT NOT NULL DEFAULT '',
ADD COLUMN category_bobot NUMERIC(5,2) DEFAULT 0,
ADD COLUMN subcategory_bobot NUMERIC(5,2) DEFAULT 0;

-- 2. Update existing 'bobot' column to be NUMERIC(5,2) (it was INTEGER)
-- We need to change type. If existing data exists, we cast it.
ALTER TABLE public.audit_items
ALTER COLUMN bobot TYPE NUMERIC(5,2);

-- 3. (Optional) We can drop 'komponen' if we don't need it, or keep it for legacy.
-- For now, we will just ignore it in the new code.
-- ALTER TABLE public.audit_items DROP COLUMN komponen;
