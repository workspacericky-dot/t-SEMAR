# Rekomendasi Asesor

**Desain terbaru:** analisis manual melalui Project ChatGPT, satu ekspor seluruh ujian per siswa, lalu impor rekomendasi untuk review. Lihat [panduan workflow](chatgpt-workflow/README.md), [instruksi Project siap ditempel](chatgpt-workflow/PROJECT_INSTRUCTIONS.md), dan [prompt operasional](chatgpt-workflow/PROMPTS.md). Dokumen di bawah menjelaskan implementasi panel awal; ekspor/impor manual belum diimplementasikan.

Panel tersedia untuk admin/superadmin pada halaman UTS/UAS. Penilaian berfokus pada hubungan Jwb Evaluator, Catatan, Rekomendasi, serta inti/perspektif kriteria. Jwb Auditee hanya konteks. Eviden asli tidak diperiksa.

## Status aktivasi

Koneksi analisis eksternal belum diaktifkan. Desain terbaru memakai pengiriman manual oleh dosen melalui ChatGPT, sehingga tidak merencanakan pemanggilan API dari aplikasi. Implementasi saat ini tidak mengirim data ke layanan AI. Hanya jawaban seluruhnya kosong yang dapat memperoleh rekomendasi lokal nilai 0, mengikuti contoh UTS. Tidak ada simulasi nilai AI untuk jawaban yang terisi.

Sebelum dipakai pada aplikasi yang terhubung database, jalankan `supabase/migrations/20260929090000_assessor_recommendations.sql` melalui mekanisme migrasi Supabase proyek. Migrasi belum diterapkan pada database produksi oleh implementasi ini. Server menggunakan konfigurasi Supabase yang sudah berlaku: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`.

## Alur review

1. Siswa menyelesaikan ujian (submit atau batas waktu berakhir).
2. Dosen membuka panel Rekomendasi Asesor pada tabel ujian.
3. Analisis menghasilkan draft tersimpan terpisah, tanpa mengubah `teacher_score`/`catatan_asesor`.
4. Dosen memeriksa dasar penilaian, menyunting usulan nilai/catatan bila perlu.
5. Approve kriteria menyimpan satu pasangan. Approve komponen menyimpan seluruh pasangan yang masih pending pada komponen; yang telah disahkan tidak ditimpa.
6. Approval mencatat siapa/waktu dan pasangan yang disahkan. Seluruh approval komponen berada dalam satu transaksi PostgreSQL. Perubahan jawaban, penggantian draft, atau perubahan penilaian manual sejak analisis membatalkan approval.

Nilai yang terisi 1–100; 0 tetap tersedia untuk jawaban kosong dan koreksi manual, sesuai contoh UTS. Penilaian manual tetap tersedia. Draft tidak dapat dibaca siswa dan tidak ditambahkan ke ekspor hasil ujian. Export dan rata-rata ujian menggunakan nilai resmi setelah approval.

## Kalibrasi

`src/lib/assessor/reference.json` adalah bahan lokal privat (diabaikan Git), berisi 75 contoh per kriteria dari tiga PDF, interpretasi Excel beserta lokator sel, dan definisi grade per perspektif dari tabel referensi terbaru. Identitas siswa pada judul PDF tidak diekstrak. Halaman tabel yang bersambung digabungkan per kriteria. Jalankan `python scripts/extract-assessor-reference.py` dengan `openpyxl` dan `pdfplumber` untuk memperbarui bahan jika referensi berubah, lalu naikkan versi rubrik di ekstraktor dan `reasoning.ts`.

`reference.public.json` yang dipakai build publik hanya berisi aturan generik dan contoh fiktif. Tidak ada jawaban atau nilai mahasiswa asli dalam dataset publik.

`rubric.ts` menyediakan instruksi reasoning-only, jangkar skor, contoh kriteria yang relevan, dan batas terhadap instruksi yang disisipkan dalam jawaban siswa. Koreksi faktual eviden dalam contoh lama tidak menjadi kewajiban pemeriksaan baru. Tidak ada klaim akurasi yang telah tervalidasi; komponen selain Perencanaan membutuhkan kalibrasi tambahan.

## Verifikasi

`npm run test:assessor` menguji validasi skor, lingkup input, kondisi provider nonaktif, RLS draft, batas peran/ujian, approval berpasangan, dan rollback komponen menggunakan PostgreSQL lokal PGlite tanpa koneksi ke database produksi.

`npx tsc --noEmit` memeriksa tipe, dan `npm run build` memverifikasi build aplikasi. Pengujian AI terhadap jawaban berisi dan pengujian dengan sesi dosen di database terhubung masih diperlukan setelah aktivasi.
