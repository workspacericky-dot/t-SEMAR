-- Add auditor_rebuttal column for Phase 4b (auditor's opposing statement when rejecting dispute)
ALTER TABLE public.audit_items ADD COLUMN IF NOT EXISTS auditor_rebuttal TEXT;
