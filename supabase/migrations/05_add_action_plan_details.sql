-- Columns: auditee_action_plan, target, waktu start/end, pic, progress slider, file link
ALTER TABLE public.audit_items 
ADD COLUMN IF NOT EXISTS auditee_action_plan TEXT,
ADD COLUMN IF NOT EXISTS tl_target TEXT,
ADD COLUMN IF NOT EXISTS tl_waktu TEXT,
ADD COLUMN IF NOT EXISTS tl_pic TEXT,
ADD COLUMN IF NOT EXISTS tl_progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tl_file_link TEXT;
