# Workflow satu siswa, seluruh ujian, melalui ChatGPT

Ekspor seluruh ujian per siswa, impor JSON manual, review, dan approval tersedia pada panel Rekomendasi Asesor setelah migrasi database diterapkan. Aplikasi tidak memanggil API AI.

## Persiapan database

Terapkan berurutan melalui migrasi Supabase atau SQL Editor proyek:

1. `supabase/migrations/20260929090000_assessor_recommendations.sql` - tabel draft, RLS, dan fungsi approval. Bila sudah diterapkan, jangan menjalankannya ulang.
2. `supabase/migrations/20260929100000_assessor_chatgpt_workflow.sql` - manifest ekspor, draft nullable, diagnosis, dan impor atomik.

Migrasi produksi belum dijalankan dari workspace ini. Server memakai konfigurasi Supabase yang sudah berlaku; tidak memerlukan API key AI.

## Cara menggunakan sebagai dosen

1. Masuk sebagai dosen/admin dan buka UTS/UAS siswa yang sudah selesai (submit atau batas waktu berakhir).
2. Buka **Panduan setup Project & prompt analisis** pada panel Rekomendasi Asesor.
3. Buat Project **t-SEMAR Assistive Assessor** di ChatGPT. Tempel isi PROJECT_INSTRUCTIONS.md ke Instructions. Unggah KNOWLEDGE.md, OUTPUT_CONTRACT.md, output.schema.json, dan CALIBRATION.json sebagai sumber tetap. Kalibrasi dosen diambil dari repositori GitHub yang telah dipublikasikan atas persetujuan pemilik; tautannya tersedia di panel.
4. Gunakan prompt nomor 1 pada PROMPTS.md untuk memeriksa setup. File lokal perlu diunggah ke Project; membuka file di IDE tidak membuat ChatGPT dapat membacanya.
5. Tentukan tahun referensi bila perlu (default tahun ujian dikurangi satu). Klik **Ekspor seluruh ujian siswa**.
6. Buat chat baru dalam Project untuk siswa tersebut, pilih mode Thinking/reasoning yang tersedia, unggah paket JSON, dan kirim prompt nomor 2 melalui **Salin prompt analisis**. Prompt tidak mengubah pilihan mode pada antarmuka.
7. Ambil satu JSON hasil lengkap. Pada **Impor hasil ChatGPT**, unggah file atau tempel JSON, lalu klik **Impor sebagai draft**.
8. Review seluruh komponen: jawaban siswa, usulan nilai, draft Catatan Asesor, diagnosis, alasan, dan flag. Edit seperlunya. Jika score:null, isi nilai manual dahulu.
9. Klik **Approve kriteria** atau **Approve komponen**. Nilai dan Catatan Asesor disahkan sebagai pasangan.

Impor tidak mengubah nilai resmi. Approval komponen mencakup seluruh draft pending pada komponen; pasangan yang sudah disahkan tetap dipertahankan. Semua hasil memerlukan review dosen, termasuk needs_manual_review:false.

## File Project

| File | Pemakaian |
| --- | --- |
| PROJECT_INSTRUCTIONS.md | Tempel seluruh isi ke Project Instructions. |
| KNOWLEDGE.md | Unggah sebagai sumber definisi, jangkar skor, dan ambiguitas. |
| OUTPUT_CONTRACT.md | Unggah sebagai sumber aturan hasil dan coverage. |
| output.schema.json | Unggah sebagai sumber struktur hasil yang wajib diikuti. |
| CALIBRATION.json | Kalibrasi historis dosen; unduh dari repositori GitHub melalui tautan panel. |
| CALIBRATION_SYNTHETIC.json | Contoh fiktif; tidak menggantikan kalibrasi empiris dosen. |
| PROMPTS.md | Pesan setup, analisis, revisi, perbaikan format, kelanjutan, dan audit. |
| export.schema.json | Spesifikasi teknis paket ekspor. |
| EXAMPLE_EXPORT.json / EXAMPLE_RESULT.json | Contoh latihan format; bukan untuk diimpor sebagai ujian asli. |

## Paket dan manifest

Satu siswa + satu ujian = satu paket seluruh kriteria yang ditugaskan, termasuk jawaban kosong, tanpa pilihan ekspor per komponen. Ekspor mengambil semua item audit dari server meskipun tabel sedang difilter. Urutan mengikuti sort_order dan ID sebagai pembanding bila urutannya sama.

File bernama `tsemar-<midterm/final>-<audit_id pendek>-<package_id pendek>.json`. Tidak memuat nama akun, NIP, email, eviden, feedback dosen sebelumnya, atau jawaban siswa lain. Teks bebas jawaban dapat tetap memuat nama; dosen dapat memeriksa JSON sebelum mengunggahnya. Aplikasi tidak menjamin anonimisasi teks bebas.

Metadata mencakup schema/rubrik, package_id, audit_id, waktu ekspor, tahun evaluasi dan referensi, scope entire_student_exam, jumlah kriteria, dan 24 definisi grade per perspektif. Setiap item mencakup ID, sort_order, hierarchy, perspektif, Jwb Auditee, Jwb Evaluator, Catatan, Rekomendasi, dan fingerprint. Perspektif dipetakan dari nama subkomponen keberadaan/kualitas/pemanfaatan (kemanfaatan juga dikenali); pemetaan ambigu memblokir ekspor.

Manifest server menyimpan payload ekspor, snapshot jawaban, snapshot feedback dosen, dan versi draft saat ekspor. Snapshot feedback dan versi draft tidak dikirim ke ChatGPT. SHA-256 dibuat atas JSON dengan key field input diurutkan alfabetis, UTF-8 dan separator tanpa spasi; null jawaban dinormalisasi menjadi string kosong tanpa mengubah whitespace lainnya. Hash bukan signature atau bukti autentikasi; impor harus cocok dengan manifest yang tersimpan.

Hanya paket terbaru per audit yang dapat diimpor dan satu paket hanya dapat diimpor sekali. Ekspor ulang tidak mengubah nilai atau draft. Untuk revisi analisis, ekspor paket baru lalu analisis lagi. Impor mempertahankan pasangan yang sudah disahkan.

## Validasi dan kondisi gagal

- Akses server hanya dosen/admin pada UTS/UAS yang sudah selesai. JSON maksimal 4 MB; hasil memakai schema dan rubrik yang dikenal.
- ID harus persis seluruh item paket, tanpa duplikasi, item ekstra, atau item hilang. Jumlah hasil, audit, paket, versi, dan fingerprint wajib cocok.
- JSON Schema memeriksa tipe/rentang skor, diagnosis, flag, referensi, dan field tambahan. Score 0 hanya untuk grade/catatan/rekomendasi seluruhnya kosong. Score null wajib memiliki flag dan needs_manual_review:true, tetap tersimpan sebagai draft tanpa skor, dan tidak diperlakukan sebagai 0.
- Perubahan jawaban, urutan/item ujian, feedback dosen, atau versi draft sejak ekspor menggagalkan seluruh impor. Tidak ada penyimpanan sebagian. Ekspor paket baru lalu analisis kembali.
- Impor mencatat identitas/waktu importir, hasil utuh, package_id, versi rubrik dan asal ChatGPT (impor manual); aplikasi tidak mengklaim model ChatGPT tertentu.
- Approval memeriksa snapshot dan versi draft kembali di database. Nilai dan catatan disimpan bersama dalam transaksi atomik; flag tidak otomatis melarang approval setelah dosen meninjau.
- Teks hasil ditampilkan sebagai teks biasa, bukan HTML/perintah. Parser tidak mengeksekusi kontennya. Nilai resmi/rata-rata baru mengikuti approval.

Jika JSON gagal divalidasi, salin pesan kesalahan ke prompt nomor 4. Jika keluaran terpotong, gunakan prompt nomor 5 hingga memperoleh satu JSON final lengkap; jangan impor potongan.

## Lingkup penilaian dan verifikasi

Penilaian hanya kualitas reasoning siswa terhadap grade, catatan, rekomendasi, inti kriteria, dan perspektif. Jwb Auditee adalah konteks; eviden asli tidak diperiksa. JSON valid tidak membuktikan akurasi nilai ChatGPT. Lakukan kalibrasi blind dengan penilaian dosen sebelum penggunaan luas.

Pengujian otomatis mencakup schema, cakupan seluruh paket, snapshot stale, rollback impor/approval, skor null, dan akses database. Sesi dosen pada database terhubung tetap perlu diuji setelah migrasi.

Bahan asli dan kalibrasi historis dipublikasikan pada GitHub atas persetujuan pemilik pada 29 September 2026. Build aplikasi menggunakan reference.public.json dengan definisi grade generik; bahan historis tidak digunakan sebagai penyedia analisis otomatis.
