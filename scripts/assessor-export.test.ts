import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { JSDOM } from 'jsdom';
import { AssessorExamExport } from '../src/components/audit/assessor-exam-export';
import { createExamPackage } from '../src/lib/assessor/chatgpt-workflow';
import type { Audit, AuditItem } from '../src/types/database';

const auditId = '00000000-0000-4000-8000-000000000003';
const payload = createExamPackage({ id: auditId, type: 'final', year: 2026 } as Audit, [{
    id: '00000000-0000-4000-8000-000000000004', audit_id: auditId, sort_order: 0,
    category: '1. Perencanaan Kinerja', subcategory: '1. Dokumen Perencanaan kinerja telah tersedia',
    criteria: 'Terdapat pedoman teknis perencanaan kinerja.', jawaban_evaluator: 'BB', catatan: 'Tersedia.', rekomendasi: 'Pertahankan.',
} as AuditItem], 2025);
let initialized = false;
async function ui() {
    if (!initialized) {
        const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://t-semar.vercel.app' });
        Object.assign(globalThis, { window: dom.window, document: dom.window.document,
            HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
        Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
        initialized = true;
    }
    return import('@testing-library/react');
}

test('click export shows progress, then offers a persistent authenticated download without a second export', async () => {
    const { render, fireEvent, act, cleanup } = await ui();
    let complete!: (value: { payload: typeof payload }) => void;
    const pending = new Promise<{ payload: typeof payload }>(resolve => { complete = resolve; });
    let calls = 0;
    const busy: boolean[] = [];
    try {
        const view = render(createElement(AssessorExamExport, { auditId, busy: false, disabledReason: '',
            createPackage: async () => { calls++; return pending; }, onBusyChange: value => busy.push(value) }));
        fireEvent.click(view.getByRole('button', { name: 'Ekspor seluruh ujian siswa' }));
        assert.match(view.getByRole('status').textContent || '', /Sedang mengambil/);
        const loading = view.getByRole('button', { name: 'Menyiapkan paket ujian...' }) as HTMLButtonElement;
        assert.equal(loading.disabled, true);
        fireEvent.click(loading); assert.equal(calls, 1);
        await act(async () => { complete({ payload }); await pending; });
        const link = view.getByRole('link', { name: 'Unduh paket JSON' });
        assert.equal(link.getAttribute('href'), `/api/assessor/audits/${auditId}/exports/${payload.package_id}`);
        assert.equal(link.hasAttribute('download'), true);
        assert.match(view.getByRole('status').textContent || '', /Paket siap: 1 kriteria/);
        assert.equal(calls, 1); assert.deepEqual(busy, [true, false]);
    } finally { cleanup(); }
});

test('server rejection is visible next to export controls and another click retries', async () => {
    const { render, fireEvent, cleanup } = await ui();
    let calls = 0;
    try {
        const view = render(createElement(AssessorExamExport, { auditId, busy: false, disabledReason: '',
            createPackage: async () => ++calls === 1 ? { error: 'Terapkan migrasi ChatGPT pada Supabase.' } : { payload }, onBusyChange: () => {} }));
        fireEvent.click(view.getByRole('button', { name: 'Ekspor seluruh ujian siswa' }));
        assert.match((await view.findByRole('alert')).textContent || '', /Terapkan migrasi/);
        assert.equal(view.queryByRole('link', { name: 'Unduh paket JSON' }), null);
        fireEvent.click(view.getByRole('button', { name: 'Ekspor seluruh ujian siswa' }));
        await view.findByRole('link', { name: 'Unduh paket JSON' });
        assert.equal(view.queryByRole('alert'), null); assert.equal(calls, 2);
    } finally { cleanup(); }
});

test('transport failure becomes visible instead of silently ending the export', async () => {
    const { render, fireEvent, cleanup } = await ui();
    try {
        const view = render(createElement(AssessorExamExport, { auditId, busy: false, disabledReason: '',
            createPackage: async () => { throw new Error('Koneksi terputus.'); }, onBusyChange: () => {} }));
        fireEvent.click(view.getByRole('button', { name: 'Ekspor seluruh ujian siswa' }));
        assert.equal((await view.findByRole('alert')).textContent, 'Koneksi terputus.');
        assert.equal((view.getByRole('button', { name: 'Ekspor seluruh ujian siswa' }) as HTMLButtonElement).disabled, false);
    } finally { cleanup(); }
});

test('disabled export explains unsaved table changes and does not call server', async () => {
    const { render, fireEvent, cleanup } = await ui();
    let calls = 0;
    try {
        const view = render(createElement(AssessorExamExport, { auditId, busy: false,
            disabledReason: 'Selesaikan penyimpanan perubahan pada tabel sebelum ekspor.',
            createPackage: async () => { calls++; return { payload }; }, onBusyChange: () => {} }));
        const button = view.getByRole('button', { name: 'Ekspor seluruh ujian siswa' }) as HTMLButtonElement;
        assert.equal(button.disabled, true); assert.ok(view.getByText(/Selesaikan penyimpanan/));
        fireEvent.click(button); assert.equal(calls, 0);
    } finally { cleanup(); }
});
