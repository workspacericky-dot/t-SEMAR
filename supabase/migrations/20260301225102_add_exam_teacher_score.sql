-- Add teacher_score column to audit_items
ALTER TABLE public.audit_items
ADD COLUMN teacher_score numeric(5,2) DEFAULT 0;
