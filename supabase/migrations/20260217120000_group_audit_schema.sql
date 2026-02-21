-- ============================================
-- MIGRATION FOR DUAL-MODE GROUP AUDITS
-- ============================================

-- 1. Create audit_type enum & update user_role enum
DO $$ BEGIN
    CREATE TYPE audit_type AS ENUM ('group_practice', 'midterm', 'final');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'participant';

-- 2. Create audit_periods table
CREATE TABLE IF NOT EXISTS audit_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    year INT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create groups table
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id UUID REFERENCES audit_periods(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    group_number INT NOT NULL,
    lead_student_id UUID REFERENCES profiles(id),
    members UUID[], -- Array of profile IDs
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Update audits table
ALTER TABLE audits
    ADD COLUMN IF NOT EXISTS type audit_type NOT NULL DEFAULT 'group_practice',
    ADD COLUMN IF NOT EXISTS period_id UUID REFERENCES audit_periods(id),
    ADD COLUMN IF NOT EXISTS auditor_group_id UUID REFERENCES groups(id),
    ADD COLUMN IF NOT EXISTS auditee_group_id UUID REFERENCES groups(id),
    ADD COLUMN IF NOT EXISTS individual_auditor_id UUID REFERENCES profiles(id);

-- 5. Update audit_items table
ALTER TABLE audit_items
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id);

-- 6. Enable RLS on new tables
ALTER TABLE audit_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- 7. Policies for audit_periods (Read everyone, Write superadmin)
CREATE POLICY "Periods are viewable by everyone" ON audit_periods
    FOR SELECT USING (true);

CREATE POLICY "Periods are manageable by superadmin" ON audit_periods
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role = 'superadmin')
    );

-- 8. Policies for groups (Read everyone, Write superadmin)
CREATE POLICY "Groups are viewable by everyone" ON groups
    FOR SELECT USING (true);

CREATE POLICY "Groups are manageable by superadmin" ON groups
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role = 'superadmin')
    );
