-- Add master_template to the audit_type enum so 
-- the schema correctly accepts the new master template feature without throwing 22P02 invalid input.

ALTER TYPE audit_type ADD VALUE IF NOT EXISTS 'master_template';
