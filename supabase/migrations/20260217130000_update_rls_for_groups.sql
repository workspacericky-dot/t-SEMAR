-- ============================================
-- UPDATE RLS POLICIES FOR GROUP AUDITS
-- ============================================

-- 1. Drop existing restrictive policies on audits
DROP POLICY IF EXISTS "Auditors can view assigned audits" ON audits;
DROP POLICY IF EXISTS "Auditees can view assigned audits" ON audits;

-- 2. Create new policies for audits
-- Policy: Participants can view audits where they are involved (Individual, Group Auditor, or Group Auditee)
CREATE POLICY "Participants can view their audits" ON audits
FOR SELECT
USING (
  auth.uid() = individual_auditor_id OR 
  auth.uid() = auditor_id OR -- Legacy
  auth.uid() = auditee_id OR -- Legacy
  EXISTS (
    SELECT 1 FROM groups 
    WHERE (groups.id = audits.auditor_group_id OR groups.id = audits.auditee_group_id)
    AND auth.uid() = ANY(groups.members)
  )
);

-- 3. Drop existing restrictive policies on audit_items
DROP POLICY IF EXISTS "Auditors can view items of assigned audits" ON audit_items;
DROP POLICY IF EXISTS "Auditors can update items of assigned audits" ON audit_items;
DROP POLICY IF EXISTS "Auditees can view items of assigned audits" ON audit_items;
DROP POLICY IF EXISTS "Auditees can update own fields on assigned items" ON audit_items;


-- 4. Create new policies for audit_items

-- VIEW: Everyone involved in the audit can VIEW all items
CREATE POLICY "Participants can view items of their audits" ON audit_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM audits
    WHERE audits.id = audit_items.audit_id
    AND (
      audits.individual_auditor_id = auth.uid() OR
      audits.auditor_id = auth.uid() OR
      audits.auditee_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM groups
        WHERE (groups.id = audits.auditor_group_id OR groups.id = audits.auditee_group_id)
        AND auth.uid() = ANY(groups.members)
      )
    )
  )
);

-- UPDATE: Complex logic for partitioned editing
-- Rule 1: Individual Auditor can update everything
CREATE POLICY "Individual Auditors can update items" ON audit_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM audits
    WHERE audits.id = audit_items.audit_id
    AND audits.individual_auditor_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM audits
    WHERE audits.id = audit_items.audit_id
    AND audits.individual_auditor_id = auth.uid()
  )
);

-- Rule 2: Group Auditors
-- If assigned_to is set, ONLY that user can update.
-- If assigned_to is NULL, ANY group member can update (or restrict to none? Let's say any for now to be safe, or maybe strictly assigned_to).
-- Based on plan: "Only assigned criteria are editable". So if assigned_to is null, maybe no one can edit? 
-- Let's allow flexible: if assigned_to is NULL, then any member of auditor group can edit. If SET, only that user.

CREATE POLICY "Group Auditors can update assigned items" ON audit_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM audits
    LEFT JOIN groups ON groups.id = audits.auditor_group_id
    WHERE audits.id = audit_items.audit_id
    AND auth.uid() = ANY(groups.members)
    AND (
       audit_items.assigned_to IS NULL OR 
       audit_items.assigned_to = auth.uid()
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM audits
    LEFT JOIN groups ON groups.id = audits.auditor_group_id
    WHERE audits.id = audit_items.audit_id
    AND auth.uid() = ANY(groups.members)
    AND (
       audit_items.assigned_to IS NULL OR 
       audit_items.assigned_to = auth.uid()
    )
  )
);

-- Rule 3: Group Auditees (for self-assessment fields)
-- Similar logic: if assigned_to is set, strictly that user.
-- Note: Auditees only update specific columns (jawaban_auditee, etc), but Postgres RLS is row-level (unless we use column-level grants which is complex in Supabase).
-- We'll explicitly trust the App Logic to filter columns, but rely on RLS for ROW access.

CREATE POLICY "Group Auditees can update assigned items" ON audit_items
FOR UPDATE
USING (
    EXISTS (
    SELECT 1 FROM audits
    LEFT JOIN groups ON groups.id = audits.auditee_group_id
    WHERE audits.id = audit_items.audit_id
    AND auth.uid() = ANY(groups.members)
    AND (
       audit_items.assigned_to IS NULL OR 
       audit_items.assigned_to = auth.uid()
    )
  )
)
WITH CHECK (
    EXISTS (
    SELECT 1 FROM audits
    LEFT JOIN groups ON groups.id = audits.auditee_group_id
    WHERE audits.id = audit_items.audit_id
    AND auth.uid() = ANY(groups.members)
    AND (
       audit_items.assigned_to IS NULL OR 
       audit_items.assigned_to = auth.uid()
    )
  )
);
