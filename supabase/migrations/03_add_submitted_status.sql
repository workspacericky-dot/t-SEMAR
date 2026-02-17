-- Add SUBMITTED status to the enum
ALTER TYPE public.audit_item_status ADD VALUE IF NOT EXISTS 'SUBMITTED';
