import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuditTable } from '../src/components/audit/audit-table';
import { reasoningInput, sameReasoning, validateApproval, validateResult } from '../src/lib/assessor/reasoning';
import { buildAssessorInstructions } from '../src/lib/assessor/rubric';
import { analyzeReasoning } from '../src/lib/assessor/provider';

const teacher = '00000000-0000-0000-0000-000000000001';
const student = '00000000-0000-0000-0000-000000000002';
const audit = '00000000-0000-0000-0000-000000000003';
const first = '00000000-0000-0000-0000-000000000004';
const second = '00000000-0000-0000-0000-000000000005';
const category = '1. Perencanaan Kinerja';
const timestamp = '2026-09-29T00:00:00.000Z';
const input = reasoningInput({ category, subcategory: '1. Keberadaan', criteria: 'Kriteria', jawaban_auditee: 'AA', jawaban_evaluator: 'BB', catatan: 'Seluruh unsur terpenuhi.', rekomendasi: 'Pertahankan.' });

async function database() {
    const db = new PGlite();
    await db.exec(`
        create role anon; create role authenticated; create role service_role bypassrls;
        create schema auth;
        create function auth.uid() returns uuid language sql as 'select null::uuid';
        create table profiles (id uuid primary key, role text);
        create table audits (id uuid primary key, type text, is_manually_locked boolean, exam_expires_at timestamptz, exam_start_time timestamptz, time_limit_minutes integer);
        create table audit_items (id uuid primary key, audit_id uuid references audits(id), category text, subcategory text, criteria text,
          jawaban_auditee text, jawaban_evaluator text, catatan text, rekomendasi text, teacher_score numeric, catatan_asesor text);
        grant usage on schema public, auth to anon, authenticated, service_role;
        grant select on profiles to authenticated, service_role;
        grant all on audits, audit_items to service_role;
        insert into profiles values ('${teacher}', 'admin'), ('${student}', 'auditor');
        insert into audits values ('${audit}', 'final', true, null, null, 90);
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/20260929090000_assessor_recommendations.sql', import.meta.url), 'utf8'));
    for (const id of [first, second]) {
        await db.query(`insert into audit_items values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, '')`,
            [id, audit, input.category, input.subcategory, input.criteria, input.jawaban_auditee, input.jawaban_evaluator, input.catatan, input.rekomendasi]);
        await db.query(`insert into assessor_recommendations
          (item_id, audit_id, score, assessor_note, rationale, input_snapshot, feedback_snapshot, model, rubric_version, generated_by, updated_at)
          values ($1, $2, 80, 'Analisis baik.', 'Selaras.', $3::jsonb, $4::jsonb, 'fixture', 'v1', $5, $6)`,
            [id, audit, JSON.stringify(input), JSON.stringify({ teacher_score: 0, catatan_asesor: '' }), teacher, timestamp]);
    }
    return db;
}

const approval = (id: string, score = 85, note = 'Catatan disunting dosen.') => ({ item_id: id, expected_updated_at: timestamp, score, assessor_note: note });
async function approve(db: PGlite, entries = [approval(first)], component: string | null = null, user = teacher) {
    return db.query<{ result: { teacher_score: number; catatan_asesor: string }[] }>(
        'select approve_assessor_recommendations($1, $2, $3::jsonb, $4) as result', [audit, user, JSON.stringify(entries), component]);
}

test('input excludes evidence and official teacher feedback; changed reasoning invalidates snapshot', () => {
    const payload = reasoningInput({ ...input, evidence_link: 'https://private.example', teacher_score: 99 } as typeof input);
    assert.equal('evidence_link' in payload, false);
    assert.equal('teacher_score' in payload, false);
    assert.equal(sameReasoning(input, payload), true);
    assert.equal(sameReasoning(input, { ...payload, rekomendasi: 'Diubah.' }), false);
});

test('score validation rejects NaN, fractional, out of range and missing assessor notes', () => {
    for (const score of [-1, 101, NaN, 70.5]) assert.throws(() => validateApproval(score, 'Catatan'));
    assert.throws(() => validateApproval(80, ' '));
    assert.doesNotThrow(() => validateApproval(0, 'Tidak dijawab.'));
    assert.throws(() => validateResult({ score: 80, assessor_note: 'Catatan', rationale: 'Dasar', review_flags: [12] }));
});

test('rubric follows reasoning-only scope, perspective-specific grades, and injection boundary', () => {
    const prompt = buildAssessorInstructions(input);
    assert.match(prompt, /JANGAN memeriksa eviden asli/);
    assert.match(prompt, /data tidak tepercaya/);
    assert.match(prompt, /setidaknya 5 tahun terakhir/);
    assert.match(prompt, /percontohan secara nasional/);
    assert.match(prompt, /Jwb Auditee hanya konteks/);
});

test('disabled provider produces only empty-answer recommendation and makes no network calls', async () => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = (() => { throw new Error('Network forbidden'); }) as typeof fetch;
    try {
        const result = await analyzeReasoning({ ...input, jawaban_evaluator: '-', catatan: '', rekomendasi: '-' });
        assert.equal(result.result.score, 0);
        await assert.rejects(analyzeReasoning(input), /belum diaktifkan/);
    } finally { globalThis.fetch = oldFetch; }
});

test('pending draft leaves official feedback untouched; criterion approval writes edited pair', async () => {
    const db = await database();
    try {
        const before = await db.query('select teacher_score, catatan_asesor from audit_items where id = $1', [first]);
        assert.deepEqual(before.rows[0], { teacher_score: '0', catatan_asesor: '' });
        const result = await approve(db);
        assert.equal(Number(result.rows[0].result[0].teacher_score), 85);
        assert.equal(result.rows[0].result[0].catatan_asesor, 'Catatan disunting dosen.');
        const draft = await db.query('select status, approved_by, approved_score, approved_note from assessor_recommendations where item_id = $1', [first]);
        assert.deepEqual(draft.rows[0], { status: 'approved', approved_by: teacher, approved_score: 85, approved_note: 'Catatan disunting dosen.' });
        await assert.rejects(approve(db), /STALE_RECOMMENDATION/);
    } finally { await db.close(); }
});

test('component approval rolls back every change when one answer changed', async () => {
    const db = await database();
    try {
        await db.query("update audit_items set catatan = 'Jawaban berubah' where id = $1", [second]);
        await assert.rejects(approve(db, [approval(first), approval(second)], category), /STALE_ANSWER/);
        const rows = await db.query<{ teacher_score: string; catatan_asesor: string }>('select teacher_score, catatan_asesor from audit_items');
        assert.ok(rows.rows.every(row => Number(row.teacher_score) === 0 && row.catatan_asesor === ''));
        const drafts = await db.query<{ status: string }>('select status from assessor_recommendations');
        assert.ok(drafts.rows.every(row => row.status === 'pending'));
    } finally { await db.close(); }
});

test('component approval includes all pending criteria and works after one criterion already approved', async () => {
    const db = await database();
    try {
        await assert.rejects(approve(db, [approval(first)], category), /INCOMPLETE_COMPONENT/);
        await approve(db);
        const result = await approve(db, [approval(second, 70)], category);
        assert.equal(result.rows[0].result.length, 1);
        const rows = await db.query<{ teacher_score: string }>('select teacher_score from audit_items order by id');
        assert.deepEqual(rows.rows.map(row => Number(row.teacher_score)), [85, 70]);
    } finally { await db.close(); }
});

test('approval rejects changed teacher feedback, replaced recommendation, duplicate IDs and invalid score', async () => {
    const db = await database();
    try {
        await assert.rejects(approve(db, [approval(first), approval(first)], category), /DUPLICATE_ENTRIES/);
        await assert.rejects(approve(db, [approval(first, 101)]), /INVALID_FEEDBACK/);
        await assert.rejects(approve(db, [approval(first, 85, '')]), /INVALID_FEEDBACK/);
        await assert.rejects(approve(db, [{ ...approval(first), expected_updated_at: '2026-01-01T00:00:00Z' }]), /STALE_RECOMMENDATION/);
        await db.query("update audit_items set teacher_score = 90, catatan_asesor = 'Manual' where id = $1", [first]);
        await assert.rejects(approve(db), /STALE_FEEDBACK/);
    } finally { await db.close(); }
});

test('wrong roles, active exams, cross-component IDs and non-exam audits cannot approve', async () => {
    const db = await database();
    try {
        await assert.rejects(approve(db, [approval(first)], null, student), /FORBIDDEN/);
        await db.query('update audit_items set category = $1 where id = $2', ['2. Pengukuran Kinerja', second]);
        await assert.rejects(approve(db, [approval(second)], category), /INVALID_SCOPE/);
        await db.exec('update audits set is_manually_locked = false');
        await assert.rejects(approve(db), /EXAM_ACTIVE/);
        await db.exec("update audits set type = 'group_practice'");
        await assert.rejects(approve(db), /INVALID_EXAM/);
    } finally { await db.close(); }
});

test('student cannot read drafts or call approval RPC even with teacher ID', async () => {
    const db = await database();
    try {
        await db.exec('set role authenticated');
        const result = await db.query('select * from assessor_recommendations');
        assert.equal(result.rows.length, 0);
        await assert.rejects(approve(db), /permission denied for function/);
        await assert.rejects(db.exec("update assessor_recommendations set score = 100"), /permission denied/);
    } finally { await db.close(); }
});


test('recommendation panel renders only for teachers on UTS/UAS, not students or group practice', () => {
    const render = (role: 'admin' | 'auditor', auditType: string) => renderToStaticMarkup(createElement(AuditTable, {
        items: [], role, auditId: audit, auditType, onItemsUpdate: () => {},
    }));
    assert.match(render('admin', 'final'), /Rekomendasi Asesor/);
    assert.match(render('admin', 'midterm'), /Ekspor seluruh ujian siswa/);
    assert.match(render('admin', 'final'), /Impor sebagai draft/);
    assert.doesNotMatch(render('admin', 'final'), /Koneksi AI belum aktif|Analisis komponen|Analisis kriteria/);
    assert.doesNotMatch(render('auditor', 'final'), /Rekomendasi Asesor/);
    assert.doesNotMatch(render('admin', 'group_practice'), /Rekomendasi Asesor/);
});


test('saving generated draft cannot replace a recommendation approved while analysis ran', async () => {
    const db = await database();
    try {
        const payload = {
            score: 80, assessor_note: 'Usulan baru', rationale: 'Dasar baru', review_flags: [],
            input_snapshot: input, feedback_snapshot: { teacher_score: 0, catatan_asesor: '' }, model: 'fixture', rubric_version: 'v1',
        };
        await db.query('select save_assessor_recommendation($1, $2, $3, $4, $5::jsonb)', [audit, first, teacher, timestamp, JSON.stringify(payload)]);
        const feedback = await db.query<{ teacher_score: string }>('select teacher_score from audit_items where id = $1', [first]);
        assert.equal(Number(feedback.rows[0].teacher_score), 0);
        await assert.rejects(db.query('select save_assessor_recommendation($1, $2, $3, $4, $5::jsonb)',
            [audit, first, teacher, timestamp, JSON.stringify(payload)]), /STALE_RECOMMENDATION/);
        await approve(db, [approval(second)]);
        await assert.rejects(db.query('select save_assessor_recommendation($1, $2, $3, $4, $5::jsonb)',
            [audit, second, teacher, timestamp, JSON.stringify(payload)]), /STALE_RECOMMENDATION/);
        const approved = await db.query<{ status: string }>('select status from assessor_recommendations where item_id = $1', [second]);
        assert.equal(approved.rows[0].status, 'approved');
    } finally { await db.close(); }
});

// Manual ChatGPT workflow: schema boundaries and actual PostgreSQL transactions.
import { createExamPackage, parseChatGPTOutput, validateOutputAgainstPackage, assessmentPerspective, type ExamPackage, type ChatGPTOutput } from '../src/lib/assessor/chatgpt-workflow';
import type { Audit, AuditItem } from '../src/types/database';

const examFixture = { id: audit, type: 'final', year: 2026 } as Audit;
const itemFixture = (id = first, order = 0) => ({ ...input, id, audit_id: audit, sort_order: order, teacher_score: 99, catatan_asesor: 'Private feedback', evidence_link: 'private evidence', assigned_to: student }) as AuditItem;
const diagnosis = { relevance: 'aligned', perspective: 'aligned', grade_consistency: 'aligned', recommendation_consistency: 'aligned', depth: 'adequate' };
function outputFixture(payload: ExamPackage): ChatGPTOutput {
    return {
        schema_version: payload.schema_version, rubric_version: payload.rubric_version,
        package_id: payload.package_id, audit_id: payload.audit_id, completion_status: 'complete',
        expected_item_count: payload.expected_item_count, result_count: payload.expected_item_count,
        results: payload.items.map(item => ({ item_id: item.item_id, input_fingerprint: item.input_fingerprint,
            score: 85, assessor_note: 'Catatan usulan.', rationale: 'Alasan usulan.', diagnosis,
            issue_codes: [], review_flags: [], needs_manual_review: false, basis_refs: ['K-SCOPE'] })),
    };
}
async function manualDatabase() {
    const db = await database();
    await db.exec('alter table audits add column year integer default 2026; alter table audit_items add column sort_order integer default 0');
    await db.exec(await readFile(new URL('../supabase/migrations/20260929100000_assessor_chatgpt_workflow.sql', import.meta.url), 'utf8'));
    const payload = createExamPackage(examFixture, [itemFixture(first), itemFixture(second, 0)], 2025);
    await db.query(`insert into assessor_export_packages (id, audit_id, exported_by, payload, reasoning_snapshots, feedback_snapshots, draft_versions)
        values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb)`, [payload.package_id, audit, teacher, JSON.stringify(payload),
        JSON.stringify({ [first]: input, [second]: input }),
        JSON.stringify({ [first]: { teacher_score: 0, catatan_asesor: '' }, [second]: { teacher_score: 0, catatan_asesor: '' } }),
        JSON.stringify({ [first]: timestamp, [second]: timestamp })]);
    return { db, payload, output: outputFixture(payload) };
}
function importManual(db: PGlite, output: ChatGPTOutput, user = teacher) {
    return db.query('select import_assessor_chatgpt_results($1, $2, $3::jsonb)', [audit, user, JSON.stringify(output)]);
}

test('export covers every supplied criterion in order, with no evidence or teacher feedback, and stable fingerprints', () => {
    const payload = createExamPackage(examFixture, [itemFixture(second, 9), itemFixture(first, 2)], 2025);
    assert.deepEqual(payload.items.map(item => item.item_id), [first, second]);
    assert.equal(payload.expected_item_count, 2);
    assert.equal(payload.grade_rules.length, 24);
    assert.equal(new Set(payload.grade_rules.map(rule => rule.perspective + rule.grade)).size, 24);
    for (const item of payload.items) {
        assert.equal('teacher_score' in item, false); assert.equal('catatan_asesor' in item, false);
        assert.equal('evidence_link' in item, false); assert.equal('assigned_to' in item, false);
        assert.match(item.input_fingerprint, /^[a-f0-9]{64}$/);
    }
    const next = createExamPackage(examFixture, [itemFixture(first, 2), itemFixture(second, 9)], 2025);
    assert.deepEqual(next.items, payload.items);
    const changed = createExamPackage(examFixture, [{ ...itemFixture(first, 2), catatan: 'Changed' }], 2025);
    assert.notEqual(changed.items[0].input_fingerprint, payload.items[0].input_fingerprint);
    assert.equal(assessmentPerspective('3. Kemanfaatan'), 'pemanfaatan');
    assert.throws(() => assessmentPerspective('Subkomponen 1'), /tidak jelas/);
    assert.throws(() => assessmentPerspective('Keberadaan dan kualitas'), /tidak jelas/);
    assert.throws(() => createExamPackage(examFixture, [], 2025), /tidak valid/);
});

test('manual result parser rejects unknown fields, wrong scores, truncated, duplicate and partial outputs', () => {
    const payload = createExamPackage(examFixture, [itemFixture()], 2025);
    const output = outputFixture(payload);
    assert.deepEqual(parseChatGPTOutput('```json\n' + JSON.stringify(output) + '\n```'), output);
    validateOutputAgainstPackage(parseChatGPTOutput(JSON.stringify(output)), payload);
    const invalids = [
        { ...output, approved: true }, { ...output, result_count: 2 },
        { ...output, results: [{ ...output.results[0], score: 100.5 }] },
        { ...output, results: [{ ...output.results[0], score: 101 }] },
        { ...output, results: [{ ...output.results[0], issue_codes: ['grade_note_conflict'] }] },
        { ...output, results: [{ ...output.results[0], assessor_note: ' ' }] },
        { ...output, results: [{ ...output.results[0], score: null }] },
        { ...output, results: [{ ...output.results[0], diagnosis: { ...diagnosis, depth: 'invented' } }] },
        { ...output, results: [output.results[0], output.results[0]], expected_item_count: 2, result_count: 2 },
    ];
    for (const invalid of invalids) assert.throws(() => parseChatGPTOutput(JSON.stringify(invalid)));
    assert.throws(() => parseChatGPTOutput(JSON.stringify(output).slice(0, -2)), /belum lengkap/);
    assert.throws(() => parseChatGPTOutput(' '.repeat(4 * 1024 * 1024 + 1)), /4 MB/);
    for (const invalid of [{ ...output, audit_id: student }, { ...output, package_id: student },
        { ...output, results: [{ ...output.results[0], input_fingerprint: '0'.repeat(64) }] },
        { ...output, results: [{ ...output.results[0], item_id: second }] }]) {
        assert.throws(() => validateOutputAgainstPackage(invalid, payload));
    }
    const missing = outputFixture(createExamPackage(examFixture, [itemFixture(), itemFixture(second)], 2025));
    missing.results.pop(); missing.result_count = 1; missing.expected_item_count = 1;
    assert.throws(() => validateOutputAgainstPackage(missing, payload));
});

test('zero requires actually empty student answer; null stays unscored with explicit review flag', () => {
    const payload = createExamPackage(examFixture, [itemFixture()], 2025);
    const output = outputFixture(payload);
    output.results[0] = { ...output.results[0], score: 0, issue_codes: ['empty_answer'] };
    assert.throws(() => validateOutputAgainstPackage(output, payload), /Nilai 0/);
    output.results[0] = { ...output.results[0], score: null, issue_codes: ['ambiguous_rubric'], needs_manual_review: true, review_flags: ['Perlu penilaian dosen.'] };
    validateOutputAgainstPackage(parseChatGPTOutput(JSON.stringify(output)), payload);
    const empty = createExamPackage(examFixture, [{ ...itemFixture(), jawaban_evaluator: '-', catatan: '', rekomendasi: '-' }], 2025);
    const zero = outputFixture(empty); zero.results[0].score = 0; zero.results[0].issue_codes = ['empty_answer'];
    validateOutputAgainstPackage(parseChatGPTOutput(JSON.stringify(zero)), empty);
});

test('manual import persists complete drafts atomically; null can be scored by teacher approval; repeated import cannot overwrite', async () => {
    const { db, payload, output } = await manualDatabase();
    try {
        output.results[1] = { ...output.results[1], score: null, needs_manual_review: true, review_flags: ['Perlu nilai manual.'] };
        await importManual(db, output);
        const official = await db.query<{ teacher_score: string }>('select teacher_score from audit_items');
        assert.ok(official.rows.every(row => Number(row.teacher_score) === 0));
        const drafts = await db.query<{ item_id: string; score: number | null; status: string; package_id: string }>('select item_id, score, status, package_id from assessor_recommendations order by item_id');
        assert.deepEqual(drafts.rows.map(row => row.score), [85, null]);
        assert.ok(drafts.rows.every(row => row.status === 'pending' && row.package_id === payload.package_id));
        const imported = await db.query<{ imported_output: ChatGPTOutput }>('select imported_output from assessor_export_packages');
        assert.deepEqual(imported.rows[0].imported_output, output);
        await assert.rejects(importManual(db, output), /PACKAGE_ALREADY_IMPORTED/);
        const versions = await db.query<{ item_id: string; updated_at: string }>('select item_id, updated_at::text from assessor_recommendations');
        const entries = versions.rows.map(row => ({ ...approval(row.item_id, 77), expected_updated_at: row.updated_at }));
        await approve(db, entries, category);
        const graded = await db.query<{ teacher_score: string }>('select teacher_score from audit_items');
        assert.ok(graded.rows.every(row => Number(row.teacher_score) === 77));
    } finally { await db.close(); }
});

test('manual import rolls back whole package on stale answer, feedback or draft and invalid fingerprints', async () => {
    for (const [change, expected] of [
        ["update audit_items set catatan = 'Changed' where id = '" + second + "'", /STALE_ANSWER/],
        ["update audit_items set teacher_score = 1 where id = '" + second + "'", /STALE_FEEDBACK/],
        ["update assessor_recommendations set updated_at = now() where item_id = '" + second + "'", /STALE_RECOMMENDATION/],
        ["update audit_items set sort_order = 5 where id = '" + second + "'", /STALE_ANSWER/],
    ] as const) {
        const { db, output } = await manualDatabase();
        try {
            await db.exec(change); await assert.rejects(importManual(db, output), expected);
            const scores = await db.query<{ score: number }>('select score from assessor_recommendations');
            assert.ok(scores.rows.every(row => row.score === 80));
            const manifest = await db.query<{ imported_at: string | null }>('select imported_at from assessor_export_packages');
            assert.equal(manifest.rows[0].imported_at, null);
        } finally { await db.close(); }
    }
    const { db, output } = await manualDatabase();
    try {
        output.results[1].input_fingerprint = '0'.repeat(64);
        await assert.rejects(importManual(db, output), /INVALID_FINGERPRINT/);
        const scores = await db.query<{ score: number }>('select score from assessor_recommendations');
        assert.ok(scores.rows.every(row => row.score === 80));
    } finally { await db.close(); }
});

test('import guards roles, active exams, extra IDs, duplicate IDs and unknown or superseded packages', async () => {
    const { db, output, payload } = await manualDatabase();
    try {
        await assert.rejects(importManual(db, output, student), /FORBIDDEN/);
        await assert.rejects(importManual(db, { ...output, package_id: student }), /UNKNOWN_PACKAGE/);
        await assert.rejects(importManual(db, { ...output, results: [output.results[0], output.results[0]] }), /INCOMPLETE_RESULTS/);
        await assert.rejects(importManual(db, { ...output, results: [output.results[0], { ...output.results[1], item_id: student }] }), /INVALID_FINGERPRINT/);
        await db.exec('update audits set is_manually_locked = false');
        await assert.rejects(importManual(db, output), /EXAM_ACTIVE/);
        await db.exec('update audits set is_manually_locked = true');
        await db.query(`insert into assessor_export_packages (id, audit_id, exported_by, payload, reasoning_snapshots, feedback_snapshots, draft_versions, exported_at)
            select $1, audit_id, exported_by, payload, reasoning_snapshots, feedback_snapshots, draft_versions, exported_at + interval '1 second'
            from assessor_export_packages where id = $2`, [student, payload.package_id]);
        await assert.rejects(importManual(db, output), /SUPERSEDED_PACKAGE/);
        await db.exec('set role authenticated');
        const manifests = await db.query('select * from assessor_export_packages'); assert.equal(manifests.rows.length, 0);
        await assert.rejects(importManual(db, output), /permission denied for function/);
    } finally { await db.close(); }
});

test('import of newly exported package preserves previously approved pairs', async () => {
    const { db, payload, output } = await manualDatabase();
    try {
        await approve(db);
        const version = await db.query<{ updated_at: string }>('select updated_at::text from assessor_recommendations where item_id = $1', [first]);
        await db.query(`update assessor_export_packages set feedback_snapshots = jsonb_set(feedback_snapshots, array[$1], $2::jsonb),
            draft_versions = jsonb_set(draft_versions, array[$1], to_jsonb($3::text)) where id = $4`,
            [first, JSON.stringify({ teacher_score: 85, catatan_asesor: 'Catatan disunting dosen.' }), version.rows[0].updated_at, payload.package_id]);
        output.results[0].score = 10;
        await importManual(db, output);
        const draft = await db.query<{ score: number; status: string }>('select score, status from assessor_recommendations where item_id = $1', [first]);
        assert.deepEqual(draft.rows[0], { score: 80, status: 'approved' });
        const official = await db.query<{ teacher_score: string }>('select teacher_score from audit_items where id = $1', [first]);
        assert.equal(Number(official.rows[0].teacher_score), 85);
    } finally { await db.close(); }
});

import { AUDIT_CRITERIA_TEMPLATE } from '../src/lib/data/criteria';

test('export accepts the entire actual application template across all twelve subcomponents', () => {
    const items = AUDIT_CRITERIA_TEMPLATE.map((item, index) => ({ ...itemFixture(), ...item,
        id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}` }));
    const payload = createExamPackage(examFixture, items, 2025);
    assert.equal(payload.expected_item_count, AUDIT_CRITERIA_TEMPLATE.length);
    assert.equal(new Set(payload.items.map(item => item.category)).size, 4);
    assert.equal(new Set(payload.items.map(item => item.category + item.subcategory)).size, 12);
    const expected = ['keberadaan', 'kualitas', 'pemanfaatan'];
    for (const item of payload.items) {
        // Ground truth from the established three subcomponents per category of this fixed template.
        const index = Number(item.subcategory.match(/^([123])\./)?.[1]);
        assert.equal(item.assessment_perspective, expected[index - 1]);
    }
    assert.throws(() => assessmentPerspective('1. Nama subkomponen baru', '1. Perencanaan Kinerja'), /tidak jelas/);
    assert.throws(() => assessmentPerspective('1. Dokumen Perencanaan kinerja telah tersedia', 'Komponen tidak dikenal'), /tidak jelas/);
});
