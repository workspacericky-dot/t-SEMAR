ALTER TABLE public.audit_items
ADD COLUMN IF NOT EXISTS deskripsi_auditee TEXT;
