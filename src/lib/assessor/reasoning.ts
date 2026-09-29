export const RUBRIC_VERSION = '2026-09-29-v2-public';

export interface ReasoningInput {
    category: string;
    subcategory: string;
    criteria: string;
    jawaban_auditee: string | null;
    jawaban_evaluator: string | null;
    catatan: string | null;
    rekomendasi: string | null;
}

export interface ReasoningResult {
    score: number;
    assessor_note: string;
    rationale: string;
    review_flags: string[];
}

export interface AssessorRecommendation extends Omit<ReasoningResult, 'score'> {
    score: number | null;
    diagnosis?: Record<string, string>;
    issue_codes?: string[];
    basis_refs?: string[];
    needs_manual_review?: boolean;
    package_id?: string | null;
    item_id: string;
    audit_id: string;
    input_snapshot: ReasoningInput;
    feedback_snapshot: { teacher_score: number; catatan_asesor: string };
    status: 'pending' | 'approved';
    model: string;
    rubric_version: string;
    created_at: string;
    updated_at: string;
    approved_at: string | null;
    approved_by: string | null;
    approved_score: number | null;
    approved_note: string | null;
}

export function reasoningInput(item: Partial<ReasoningInput>): ReasoningInput {
    return {
        category: item.category || '', subcategory: item.subcategory || '', criteria: item.criteria || '',
        jawaban_auditee: item.jawaban_auditee || '', jawaban_evaluator: item.jawaban_evaluator || '',
        catatan: item.catatan || '', rekomendasi: item.rekomendasi || '',
    };
}

export function sameReasoning(a: ReasoningInput, b: ReasoningInput): boolean {
    return Object.keys(a).every(key => a[key as keyof ReasoningInput] === b[key as keyof ReasoningInput]);
}

export function validateResult(value: unknown): ReasoningResult {
    if (!value || typeof value !== 'object') throw new Error('Format hasil AI tidak valid.');
    const result = value as ReasoningResult;
    if (!Number.isInteger(result.score) || result.score < 0 || result.score > 100 ||
        typeof result.assessor_note !== 'string' || !result.assessor_note.trim() || result.assessor_note.length > 6000 ||
        typeof result.rationale !== 'string' || !result.rationale.trim() || result.rationale.length > 6000 ||
        !Array.isArray(result.review_flags) || result.review_flags.length > 12 ||
        result.review_flags.some(flag => typeof flag !== 'string' || flag.length > 1000)) {
        throw new Error('Nilai atau catatan dari AI tidak valid. Silakan analisis ulang.');
    }
    return result;
}

export function validateApproval(score: number, note: string) {
    if (!Number.isInteger(score) || score < 0 || score > 100 || !note.trim() || note.length > 6000) {
        throw new Error('Isi nilai bulat 0–100 dan Catatan Asesor sebelum approval.');
    }
}
