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
    assert.match(render('admin', 'midterm'), /Koneksi AI belum aktif/);
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
