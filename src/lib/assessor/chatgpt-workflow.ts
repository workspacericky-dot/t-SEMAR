import { createHash, randomUUID } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import exportSchema from '../../../references/tsemar-assessor/chatgpt-workflow/export.schema.json';
import outputSchema from '../../../references/tsemar-assessor/chatgpt-workflow/output.schema.json';
import reference from './reference.public.json';
import perspectiveMap from './perspective-map.json';
import { reasoningInput } from './reasoning';
import type { Audit, AuditItem } from '@/types/database';

export const CHATGPT_SCHEMA = 'tsemar-chatgpt-assessor/v1';
export const CHATGPT_RUBRIC = '2026-09-29-chatgpt-v1';
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
type Perspective = 'keberadaan' | 'kualitas' | 'pemanfaatan';
export type ExportItem = ReturnType<typeof exportItem>;
export interface ExamPackage {
    schema_version: string; rubric_version: string; package_id: string; audit_id: string;
    exported_at: string; exam_type: 'midterm' | 'final'; evaluation_year: number; reference_year: number;
    scope: 'entire_student_exam'; expected_item_count: number;
    grade_rules: { perspective: Perspective; grade: string; description: string }[];
    items: ExportItem[];
}
export interface ChatGPTResult {
    item_id: string; input_fingerprint: string; score: number | null; assessor_note: string; rationale: string;
    diagnosis: Record<string, string>; issue_codes: string[]; review_flags: string[];
    needs_manual_review: boolean; basis_refs: string[];
}
export interface ChatGPTOutput {
    schema_version: string; rubric_version: string; package_id: string; audit_id: string;
    completion_status: 'complete'; expected_item_count: number; result_count: number; results: ChatGPTResult[];
}
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateExport = ajv.compile(exportSchema);
const validateOutput = ajv.compile(outputSchema);

export function assessmentPerspective(subcategory: string, category?: string): Perspective {
    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
    // Explicit mappings for actual t-SEMAR subcomponents, scoped to the parent component.
    // A numeric prefix alone is never used to infer the perspective of an unfamiliar title.
    const known = category && perspectiveMap.find(entry => normalize(entry.category) === normalize(category)
        && normalize(entry.subcategory) === normalize(subcategory));
    if (known) return known.perspective as Perspective;
    const text = subcategory.toLowerCase();
    const found = (['keberadaan', 'kualitas', 'pemanfaatan'] as const).filter(word =>
        new RegExp(`\\b${word}\\b`).test(text) || (word === 'pemanfaatan' && /\bkemanfaatan\b/.test(text)));
    if (found.length !== 1) throw new Error(`Perspektif subkomponen tidak jelas: ${subcategory}. Perbaiki nama subkomponen sebelum ekspor.`);
    return found[0];
}
function exportItem(item: AuditItem) {
    const input = {
        item_id: item.id, sort_order: item.sort_order, ...reasoningInput(item),
        assessment_perspective: assessmentPerspective(item.subcategory, item.category),
    };
    const input_fingerprint = createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)))), 'utf8').digest('hex');
    return { ...input, input_fingerprint };
}
export function createExamPackage(audit: Audit, items: AuditItem[], referenceYear: number): ExamPackage {
    if (!['midterm', 'final'].includes(audit.type)) throw new Error('Paket hanya untuk UTS/UAS.');
    if (new Set(items.map(item => item.id)).size !== items.length || items.some(item => item.audit_id !== audit.id)) {
        throw new Error('Daftar kriteria ujian tidak valid.');
    }
    const payload: ExamPackage = {
        schema_version: CHATGPT_SCHEMA, rubric_version: CHATGPT_RUBRIC,
        package_id: randomUUID(), audit_id: audit.id, exported_at: new Date().toISOString(),
        exam_type: audit.type as 'midterm' | 'final', evaluation_year: audit.year, reference_year: referenceYear,
        scope: 'entire_student_exam', expected_item_count: items.length,
        grade_rules: reference.grade_rules.map(rule => ({ ...rule, perspective: assessmentPerspective(rule.perspective) })),
        items: [...items].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)).map(exportItem),
    };
    if (!validateExport(payload)) throw new Error(`Paket ekspor tidak valid: ${ajv.errorsText(validateExport.errors, { separator: '; ' })}`);
    return payload;
}
export function isEmptyAnswer(item: { jawaban_evaluator: string | null; catatan: string | null; rekomendasi: string | null }) {
    return [item.jawaban_evaluator, item.catatan, item.rekomendasi].every(text => !text?.trim() || text.trim() === '-');
}
export function parseChatGPTOutput(text: string): ChatGPTOutput {
    if (Buffer.byteLength(text, 'utf8') > MAX_IMPORT_BYTES) throw new Error('File hasil melebihi batas 4 MB.');
    const trimmed = text.replace(/^\uFEFF/, '').trim();
    const fenced = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
    let result: unknown;
    try { result = JSON.parse(fenced ? fenced[1] : trimmed); }
    catch { throw new Error('JSON tidak valid atau belum lengkap. Tempel satu objek JSON lengkap dari ChatGPT.'); }
    if (!validateOutput(result)) throw new Error(`Format hasil tidak sesuai: ${ajv.errorsText(validateOutput.errors, { separator: '; ' }).slice(0, 1800)}`);
    const output = result as unknown as ChatGPTOutput;
    if ([...output.results].some(item => !item.assessor_note.trim() || !item.rationale.trim() || item.review_flags.some(flag => !flag.trim()) || item.basis_refs.some(ref => !ref.trim()))) {
        throw new Error('Catatan, alasan, flag, atau referensi tidak boleh hanya berisi spasi.');
    }
    if (output.results.some(item => item.issue_codes.includes('grade_note_conflict') && item.diagnosis.grade_consistency !== 'contradictory')) {
        throw new Error('Kode grade_note_conflict harus disertai diagnosis grade_consistency: contradictory.');
    }
    if (new Set(output.results.map(item => item.item_id)).size !== output.results.length) throw new Error('Ada item_id duplikat pada hasil ChatGPT.');
    if (output.expected_item_count !== output.result_count || output.result_count !== output.results.length) throw new Error('Jumlah hasil tidak lengkap atau tidak cocok dengan metadata.');
    return output;
}
export function validateOutputAgainstPackage(output: ChatGPTOutput, payload: ExamPackage) {
    if (output.audit_id !== payload.audit_id || output.package_id !== payload.package_id ||
        output.schema_version !== payload.schema_version || output.rubric_version !== payload.rubric_version ||
        output.expected_item_count !== payload.expected_item_count) throw new Error('Hasil berasal dari ujian, paket, atau versi rubrik yang berbeda. Gunakan ekspor asli.');
    const results = new Map(output.results.map(item => [item.item_id, item]));
    if (results.size !== payload.items.length) throw new Error('Hasil harus memuat seluruh kriteria ujian tepat satu kali.');
    for (const input of payload.items) {
        const result = results.get(input.item_id);
        if (!result || result.input_fingerprint !== input.input_fingerprint) throw new Error(`ID/fingerprint tidak cocok pada kriteria ${input.criteria}. Salin dari paket asli.`);
        if (result.score === 0 && (!isEmptyAnswer(input) || !result.issue_codes.includes('empty_answer'))) throw new Error(`Nilai 0 hanya untuk jawaban seluruhnya kosong: ${input.criteria}.`);
        if (result.score !== null && result.score > 0 && isEmptyAnswer(input)) throw new Error(`Jawaban seluruhnya kosong harus bernilai 0 atau null: ${input.criteria}.`);
        if (result.issue_codes.includes('empty_answer') && !isEmptyAnswer(input)) throw new Error(`Kode empty_answer tidak sesuai dengan jawaban: ${input.criteria}.`);
    }
}
