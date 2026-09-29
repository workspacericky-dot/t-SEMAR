# Rekomendasi Asesor

**Workflow:** analisis manual melalui Project ChatGPT, satu ekspor seluruh ujian per siswa, lalu impor rekomendasi untuk review. Lihat [panduan workflow](chatgpt-workflow/README.md), [instruksi Project siap ditempel](chatgpt-workflow/PROJECT_INSTRUCTIONS.md), dan [prompt operasional](chatgpt-workflow/PROMPTS.md). Ekspor/impor manual tersedia setelah kedua migrasi diterapkan.

Panel tersedia untuk admin/superadmin pada halaman UTS/UAS. Penilaian berfokus pada hubungan Jwb Evaluator, Catatan, Rekomendasi, serta inti/perspektif kriteria. Jwb Auditee hanya konteks. Eviden asli tidak diperiksa.

## Status aktivasi

Analisis dilakukan manual melalui Project ChatGPT. Aplikasi menyediakan ekspor seluruh ujian, bahan Project, salin prompt, dan impor JSON untuk review. Tidak ada API AI, API key AI, atau tombol aktivasi koneksi AI dalam workflow.

Terapkan berurutan:

1. `supabase/migrations/20260929090000_assessor_recommendations.sql` (jika belum pernah diterapkan).
2. `supabase/migrations/20260929100000_assessor_chatgpt_workflow.sql`.

Migrasi produksi belum diterapkan dari workspace ini. Server memakai konfigurasi Supabase yang sudah berlaku: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`.

## Alur review

1. Siswa menyelesaikan ujian (submit atau batas waktu berakhir).
2. Dosen membuka panel Rekomendasi Asesor pada tabel ujian.
3. Dosen mengekspor seluruh ujian, menganalisis pada ChatGPT, lalu mengimpor satu JSON lengkap. Impor menghasilkan draft tersimpan terpisah, tanpa mengubah `teacher_score`/`catatan_asesor`.
4. Dosen memeriksa dasar penilaian, menyunting usulan nilai/catatan bila perlu.
5. Approve kriteria menyimpan satu pasangan. Approve komponen menyimpan seluruh pasangan yang masih pending pada komponen; yang telah disahkan tidak ditimpa.
6. Approval mencatat siapa/waktu dan pasangan yang disahkan. Seluruh approval komponen berada dalam satu transaksi PostgreSQL. Perubahan jawaban, penggantian draft, atau perubahan penilaian manual sejak analisis membatalkan approval.

Nilai yang terisi 1–100; 0 tetap tersedia untuk jawaban kosong dan koreksi manual, sesuai contoh UTS. Penilaian manual tetap tersedia. Draft tidak dapat dibaca siswa dan tidak ditambahkan ke ekspor hasil ujian. Export dan rata-rata ujian menggunakan nilai resmi setelah approval.

## Kalibrasi

`src/lib/assessor/reference.json` berisi 75 contoh per kriteria dari tiga PDF, interpretasi Excel beserta lokator sel, dan definisi grade per perspektif dari tabel referensi terbaru. Bahan asli dan ekstraksinya diterbitkan di repositori publik dengan persetujuan pemilik pada 29 September 2026. Identitas siswa pada judul PDF tidak diekstrak, tetapi tetap ada dalam PDF asli. Halaman tabel yang bersambung digabungkan per kriteria. Jalankan `python scripts/extract-assessor-reference.py` dengan `openpyxl` dan `pdfplumber` untuk memperbarui bahan jika referensi berubah, lalu naikkan versi rubrik di ekstraktor dan `reasoning.ts`.

`reference.public.json` yang dipakai build aplikasi tetap berisi aturan generik dan contoh fiktif. Publikasi sumber historis tidak mengubah dataset yang digunakan aplikasi atau mengaktifkan koneksi AI.

`rubric.ts` menyediakan instruksi reasoning-only, jangkar skor, contoh kriteria yang relevan, dan batas terhadap instruksi yang disisipkan dalam jawaban siswa. Koreksi faktual eviden dalam contoh lama tidak menjadi kewajiban pemeriksaan baru. Tidak ada klaim akurasi yang telah tervalidasi; komponen selain Perencanaan membutuhkan kalibrasi tambahan.

## Verifikasi

`npm run test:assessor` menguji validasi skor, lingkup input, kondisi provider nonaktif, RLS draft, batas peran/ujian, approval berpasangan, dan rollback komponen menggunakan PostgreSQL lokal PGlite tanpa koneksi ke database produksi.

`npx tsc --noEmit` memeriksa tipe, dan `npm run build` memverifikasi build aplikasi. Pengujian sesi dosen pada database terhubung masih diperlukan setelah migrasi. Akurasi analisis ChatGPT membutuhkan kalibrasi empiris.
