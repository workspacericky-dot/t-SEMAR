// ============================================
// Database Types for eSEMAR v2
// ============================================

export type AuditItemStatus =
  | 'DRAFTING'
  | 'SUBMITTED' // Auditee submitted to Auditor
  | 'PUBLISHED_TO_AUDITEE' // Auditor published back to Auditee
  | 'DISPUTED'
  | 'FINAL_AGREED'
  | 'FINAL_ALTERED'
  | 'FINAL_ORIGINAL';

export type UserRole = 'superadmin' | 'admin' | 'auditor' | 'auditee' | 'participant';
export type AuditType = 'group_practice' | 'midterm' | 'final' | 'master_template';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  satker_name: string;
  avatar_url: string;
  training_group?: number;
  created_at: string;
  updated_at: string;
}

export interface AuditPeriod {
  id: string;
  name: string;
  year: number;
  is_active: boolean;
  created_at: string;
}

export interface Group {
  id: string;
  period_id: string;
  name: string;
  group_number: number;
  lead_student_id: string | null;
  members: string[] | null; // Array of UUIDs
  created_at: string;

  // Joined
  lead_student?: Profile;
}

export interface Audit {
  id: string;
  title: string;
  description: string;
  year: number;

  // New Fields
  type: AuditType;
  period_id: string | null;
  auditor_group_id: string | null;
  auditee_group_id: string | null;
  individual_auditor_id: string | null;
  time_limit_minutes?: number;
  exam_start_time?: string | null;
  scheduled_start_time?: string | null;
  is_manually_locked?: boolean;

  // Legacy (Deprecated/Migrated)
  auditor_id: string | null;
  auditee_id: string | null;

  created_by: string | null;
  status: string;
  created_at: string;
  updated_at: string;

  // Joined
  auditor?: Profile;
  auditee?: Profile;
  period?: AuditPeriod;
  auditor_group?: Group;
  auditee_group?: Group;
  individual_auditor?: Profile;
}

export type UserAuditRole = 'superadmin' | 'admin' | 'auditor' | 'auditee' | 'observer';

export interface ExtendedAudit extends Audit {
  effectiveRole: UserAuditRole;
}

export interface AuditItem {
  id: string;
  audit_id: string;

  // Hierarchy
  category: string;
  subcategory: string;
  criteria: string;
  bobot: number; // numeric(5,2)
  category_bobot?: number;
  subcategory_bobot?: number;
  deskripsi_auditee?: string;
  jawaban_auditee?: string; // AA, A, BB, etc.

  // Legacy / Deprecated
  no?: string;
  komponen?: string;

  nilai_auditee: number;
  jawaban_evaluator: string;
  nilai_evaluator: number;
  catatan: string;
  rekomendasi: string;
  status: AuditItemStatus;
  auditee_response: string;
  auditor_rebuttal?: string;
  auditee_action_plan: string;

  // Post-Exam Teacher Scoring
  teacher_score?: number;
  tl_target?: string;
  tl_waktu?: string;
  tl_pic?: string;
  tl_progress?: number;
  tl_file_link?: string;
  evidence_link?: string;
  sort_order: number;

  // New Fields
  assigned_to: string | null; // Legacy Profile ID
  auditor_assigned_to?: string | null;
  auditee_assigned_to?: string | null;

  created_at: string;
  updated_at: string;
}

// Helper type for the workflow
export const FINAL_STATUSES: AuditItemStatus[] = [
  'FINAL_AGREED',
  'FINAL_ALTERED',
  'FINAL_ORIGINAL',
];

export function isFinalStatus(status: AuditItemStatus): boolean {
  return FINAL_STATUSES.includes(status);
}
