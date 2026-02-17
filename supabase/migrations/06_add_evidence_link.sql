-- Add evidence_link column to audit_items table
ALTER TABLE public.audit_items
ADD COLUMN evidence_link text;

COMMENT ON COLUMN public.audit_items.evidence_link IS 'URL to evidence document (e.g. Google Drive link)';
