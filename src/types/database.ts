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

export type UserRole = 'superadmin' | 'auditor' | 'auditee';

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

export interface Audit {
  id: string;
  title: string;
  description: string;
  year: number;
  auditor_id: string | null;
  auditee_id: string | null;
  created_by: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // Joined
  auditor?: Profile;
  auditee?: Profile;
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
  tl_target?: string;
  tl_waktu?: string;
  tl_pic?: string;
  tl_progress?: number;
  tl_file_link?: string;
  evidence_link?: string;
  sort_order: number;
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
