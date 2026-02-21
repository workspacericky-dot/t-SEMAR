-- Drop existing constraints that might be blocking period cascading deletes
ALTER TABLE audits
    DROP CONSTRAINT IF EXISTS audits_period_id_fkey,
    DROP CONSTRAINT IF EXISTS audits_auditor_group_id_fkey,
    DROP CONSTRAINT IF EXISTS audits_auditee_group_id_fkey;

-- Re-add constraints with ON DELETE CASCADE
ALTER TABLE audits
    ADD CONSTRAINT audits_period_id_fkey 
        FOREIGN KEY (period_id) REFERENCES audit_periods(id) ON DELETE CASCADE,
    ADD CONSTRAINT audits_auditor_group_id_fkey 
        FOREIGN KEY (auditor_group_id) REFERENCES groups(id) ON DELETE CASCADE,
    ADD CONSTRAINT audits_auditee_group_id_fkey 
        FOREIGN KEY (auditee_group_id) REFERENCES groups(id) ON DELETE CASCADE;

-- Ensure audit_items cascade when an audit is deleted
ALTER TABLE audit_items
    DROP CONSTRAINT IF EXISTS audit_items_audit_id_fkey;

ALTER TABLE audit_items
    ADD CONSTRAINT audit_items_audit_id_fkey
        FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE;
