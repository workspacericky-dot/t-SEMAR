import type { ReasoningInput, ReasoningResult } from './reasoning';

/** External AI processing remains disabled until explicitly authorized. No answer leaves the server. */
export async function analyzeReasoning(input: ReasoningInput): Promise<{ result: ReasoningResult; model: string }> {
    const empty = (text: string | null) => !text?.trim() || text.trim() === '-';
    if (empty(input.jawaban_evaluator) && empty(input.catatan) && empty(input.rekomendasi)) {
        return { model: 'rubric-empty-answer', result: {
            score: 0, assessor_note: 'Siswa belum memberikan jawaban evaluator, catatan, maupun rekomendasi pada kriteria ini.',
            rationale: 'Jawaban seluruhnya kosong; mengikuti contoh UTS yang memberi nilai ujian 0 untuk soal tidak dijawab.', review_flags: [],
        } };
    }
    throw new Error('Koneksi analisis AI belum diaktifkan. Pengiriman teks jawaban siswa ke layanan AI memerlukan persetujuan pemilik aplikasi.');
}
