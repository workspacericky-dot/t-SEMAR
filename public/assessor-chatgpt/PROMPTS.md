# Prompt operasional untuk Project ChatGPT

Tempel isi `PROJECT_INSTRUCTIONS.md` ke kolom Instructions pada Project. Unggah `KNOWLEDGE.md`, `OUTPUT_CONTRACT.md`, dan `output.schema.json` sebagai sumber tetap. Prompt di bawah dikirim sebagai pesan chat, bukan ditempel seluruhnya ke Project Instructions.

## 1. Pemeriksaan setup Project, sekali sebelum penggunaan

```text
Periksa kesiapan Project t-SEMAR Assistive Assessor ini, tanpa menilai siswa.

Baca KNOWLEDGE.md, OUTPUT_CONTRACT.md, dan output.schema.json yang saya unggah. Konfirmasi file mana yang benar-benar dapat Anda baca. Jelaskan secara singkat:
1. Perbedaan grade AKIP siswa dan nilai kualitas reasoning siswa.
2. Perbedaan alasan A/AA pada keberadaan dengan kualitas/pemanfaatan.
3. Mengapa contoh UTS yang mengoreksi fakta eviden tidak memperluas lingkup tugas ini.
4. Cara menilai kontradiksi eksplisit, catatan normatif, jawaban kosong, dan data yang tidak dapat dibaca.
5. Cara memastikan satu paket seluruh ujian memiliki hasil tepat satu kali untuk setiap item_id.

Jangan mengklaim sudah mempelajari file yang tidak dapat diakses. Jika referensi penting belum tersedia atau versinya bertentangan, sebutkan masalahnya. Jangan menghasilkan JSON hasil ujian pada tahap ini.
```

## 2. Analisis seluruh ujian seorang siswa, satu chat baru per ekspor

Lampirkan file ekspor siswa ke pesan ini. Pilih mode reasoning/Thinking yang tersedia di antarmuka sebelum mengirim; teks prompt sendiri tidak mengubah pilihan mode.

```text
Analisis seluruh hasil ujian dari SATU siswa dalam file paket ekspor yang saya lampirkan. Seluruh komponen dan semua kriteria yang ditugaskan dalam paket harus dianalisis, termasuk jawaban kosong. Jangan menambahkan soal dari template master atau memakai jawaban siswa lain dari riwayat Project.

Gunakan Project Instructions, KNOWLEDGE.md, definisi grade per perspektif dalam paket, OUTPUT_CONTRACT.md, dan output.schema.json. Lingkupnya hanya kualitas reasoning berdasarkan Jwb Evaluator, Catatan, dan Rekomendasi siswa terhadap inti kriteria. Jwb Auditee hanya konteks. Tidak perlu browsing atau membuka eviden.

Pastikan paket tunggal terbaca lengkap. Identifikasi expected_item_count dan seluruh item_id; selesaikan penilaian satu per satu, lalu periksa konsistensi penggunaan jangkar skor. Jangan memberi penalti karena kebenaran faktual dokumen belum diverifikasi. Jangan menghitung rata-rata atau menetapkan nilai final siswa.

Hasil final: SATU file JSON UTF-8 lengkap sesuai kontrak, semua metadata dan fingerprint disalin tepat dari paket. Jika pembuatan file tidak tersedia, tampilkan satu blok JSON lengkap. Tidak ada status approval. Semua hasil adalah usulan untuk review dosen. Gunakan score:null dengan penjelasan bila satu item tidak dapat dinilai; tetap sertakan item tersebut agar coverage lengkap.

Sebelum menyerahkan, periksa ID unik, tidak ada item hilang/ekstra, result_count, rentang/tipe skor, diagnosis dan catatan yang selaras, serta validitas JSON. Jika tidak bisa menghasilkan semua item dalam satu keluaran lengkap, katakan belum lengkap dan jangan menandai completion_status sebagai complete. Jika kontrak atau paket penting tidak dapat diakses, jelaskan tepat apa yang kurang.
```

## 3. Revisi berdasarkan koreksi dosen pada kriteria tertentu

```text
Revisi hasil paket yang sama berdasarkan koreksi saya berikut:

item_id: [SALIN ID KRITERIA]
Koreksi dosen: [TULISKAN INTERPRETASI/KOREKSI]

Perbarui score, assessor_note, rationale, diagnosis, issue_codes, review_flags dan kebutuhan review pada item tersebut secara konsisten. Jangan menerapkan koreksi ini ke siswa lain atau kriteria lain tanpa arahan. Jika perubahan prinsip membuat item lain dalam paket yang sama perlu ditinjau, tunjukkan ID dan alasannya sebelum mengubah item tersebut.

Kembalikan SATU objek/file JSON lengkap untuk seluruh paket, bukan hanya potongan item yang direvisi. Salin metadata, ID dan fingerprint asli. Jangan mengubah jawaban siswa, schema_version, rubric_version, atau membuat status approval. Jika koreksi saya berbeda dengan jangkar historis, ikuti arahan saya untuk paket ini dan nyatakan dasar koreksi pada rationale.
```

## 4. Perbaikan format setelah validasi aplikasi gagal

```text
Perbaiki FORMAT hasil rekomendasi sesuai pesan validator berikut:
[TEMPEL PESAN VALIDATOR]

Gunakan paket ekspor dan hasil penilaian yang sudah ada dalam chat ini. Jangan mengubah skor atau alasan substantif hanya untuk memperbaiki format. Jangan menebak ID/fingerprint. Salin dari paket asli. Jika ada item yang belum dianalisis, analisis item yang hilang dengan rubrik yang sama.

Kembalikan satu JSON lengkap yang mencakup seluruh item paket. Bedakan perbaikan format dari tambahan analisis pada item yang memang sebelumnya hilang. Jika paket asli tidak terbaca, minta paket itu dilampirkan kembali; jangan membuat nilai/metadata palsu.
```

## 5. Kelanjutan jika keluaran terlalu panjang

```text
Lanjutkan analisis pada item_id yang belum selesai untuk package_id yang sama. Tetap gunakan paket asli dan rubrik yang sama. Jangan mengubah penilaian item yang sudah selesai tanpa alasan yang saya minta.

Setelah semua item selesai, gabungkan menjadi SATU file/objek JSON final lengkap untuk seluruh siswa, sesuai OUTPUT_CONTRACT.md. Jangan meminta saya mengimpor potongan JSON. Jika Anda kehilangan akses ke bagian input/hasil sebelumnya, sebutkan bagian yang perlu dilampirkan kembali. Jangan mengklaim lengkap sebelum seluruh ID sudah tercakup tepat sekali.
```

## 6. Audit kelengkapan tanpa mengubah penilaian

```text
Audit hasil JSON terhadap paket ekspor yang sama. Jangan menilai ulang atau mengubah skor.

Periksa: jumlah item dan coverage ID, metadata/versi, fingerprint yang disalin, tipe/rentang skor, score:null dengan flag review, score:0 hanya untuk jawaban kosong, diagnosis konsisten dengan issue_codes, tidak ada klaim pemeriksaan eviden, dan tidak ada status approval.

Laporkan kesalahan yang konkret. Bedakan pemeriksaan yang benar-benar dijalankan dengan alat/parser dari pemeriksaan manual. Jika hasil benar, jangan menjamin akurasi penilaian; hanya nyatakan kelengkapan/format yang sudah diperiksa.
```
