-- Add separate assignment columns for Auditor and Auditee groups
ALTER TABLE audit_items
    ADD COLUMN IF NOT EXISTS auditor_assigned_to UUID REFERENCES profiles(id),
    ADD COLUMN IF NOT EXISTS auditee_assigned_to UUID REFERENCES profiles(id);
