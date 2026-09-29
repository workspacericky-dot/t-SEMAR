# Kontrak hasil rekomendasi ChatGPT

Versi kontrak: `tsemar-chatgpt-assessor/v1`. Versi rubrik: `2026-09-29-chatgpt-v1`.

Kontrak ini didukung workflow ekspor/impor manual pada panel Rekomendasi Asesor setelah migrasi database diterapkan. ChatGPT menganalisis satu paket seluruh ujian seorang siswa dan mengembalikan satu objek JSON. Aplikasi memvalidasi hasil sebelum menyimpannya sebagai draft. JSON Schema memvalidasi struktur; kecocokan dengan paket asli, coverage, dan kondisi lintas-field perlu pemeriksaan aplikasi tersendiri.

## Objek utama

| Field | Makna dan aturan |
| --- | --- |
| `schema_version` | Salin dari ekspor, harus `tsemar-chatgpt-assessor/v1`. |
| `rubric_version` | Salin dari ekspor, harus cocok dengan bahan Project. |
| `package_id` | Identitas ekspor, salin utuh; aplikasi harus mengenal manifest server-nya. |
| `audit_id` | Identitas satu ujian siswa; salin, jangan ganti dengan nama siswa. |
| `completion_status` | `complete` hanya jika setiap kriteria memiliki tepat satu hasil. |
| `expected_item_count` | Salin jumlah kriteria paket. |
| `result_count` | Jumlah objek aktual pada `results`, harus sama dengan jumlah yang diharapkan. |
| `results` | Hasil per kriteria, urutan mengikuti ekspor; semua item wajib terwakili. |

## Hasil per kriteria

| Field | Makna dan aturan |
| --- | --- |
| `item_id` | Salin ID dari item paket. |
| `input_fingerprint` | Salin string fingerprint; jangan menghitung sendiri. |
| `score` | Integer 1–100 untuk jawaban terisi; 0 hanya jika grade, Catatan, dan Rekomendasi siswa seluruhnya kosong. `null` jika tidak dapat dinilai secara bertanggung jawab. |
| `assessor_note` | Draf Catatan Asesor, 2–4 kalimat sebagai panduan, tidak ada klaim melihat eviden. Untuk `null`, jelaskan mengapa belum dapat dinilai. Maksimal 6.000 karakter. |
| `rationale` | Ringkasan alasan yang merujuk isi jawaban/aturan, umumnya 1–3 kalimat. Bukan uraian proses berpikir internal. Maksimal 6.000 karakter. |
| `diagnosis` | Status kualitatif lima dimensi, tanpa subskor atau bobot buatan. |
| `issue_codes` | Kode masalah, boleh kosong. Lihat enum pada schema. |
| `review_flags` | Uraian spesifik untuk dosen; maksimal 12 flag, masing-masing 1.000 karakter. |
| `needs_manual_review` | `true` bila ada ambiguitas substantif/kasus belum terkalibrasi/hasil tidak dapat dinilai. Semua hasil tetap memerlukan review dan approval dosen, termasuk yang bernilai `false`. |
| `basis_refs` | ID aturan yang terbaca, misalnya `K-GRADE-QUALITY`, `K-SCORE-25`, `K-RECOMMENDATION`; maksimal 12. Rujukan asli sel/halaman hanya jika benar-benar dibaca. |

Diagnosis: `relevance` dan `perspective` memakai `aligned`, `partial`, `off_target`, `not_explained`, `not_assessable`; gunakan `partial` untuk campuran perspektif dan `off_target` untuk salah perspektif dominan. `grade_consistency`: `aligned`, `unsupported`, `contradictory`, `not_explained`, `not_assessable`. `recommendation_consistency`: `aligned`, `generic`, `contradictory`, `missing`, `not_assessable`. `depth`: `detailed`, `adequate`, `normative`, `absent`, `not_assessable`.

Diagnosis menjelaskan dasar skor; bukan lima skor yang harus dijumlahkan. `unsupported` berarti alasan kurang mendukung grade, sedangkan `contradictory` berarti narasi jelas bertentangan dengan grade. Jangan samakan kedua keadaan.

## Kondisi lintas-field yang harus diperiksa aplikasi

1. `expected_item_count = result_count = results.length = manifest.expected_item_count`.
2. Set item_id hasil persis sama dengan set item_id manifest, tanpa duplikasi, ID ekstra, atau ID hilang.
3. Schema/rubrik/package/audit cocok dengan manifest dan paket aktif. Fingerprint setiap item sama dengan nilai manifest.
4. `score:null` memerlukan `needs_manual_review:true`, setidaknya satu review flag, serta catatan/alasan yang menjelaskan hambatan. Disimpan sebagai draft dengan score nullable dan tidak diperlakukan sebagai 0; dosen mengisi skor manual sebelum approval.
5. `score:0` hanya diterima untuk jawaban yang seluruhnya kosong menurut snapshot server. `empty_answer` wajib dicantumkan. Angka `0` pada grade/nilai AKIP bukan alasan skor ujian 0.
6. `issue_codes` harus konsisten dengan diagnosis. `grade_note_conflict` harus menunjuk kontradiksi eksplisit dalam catatan/alasan, bukan hanya gaya bahasa singkat.
7. Tidak boleh ada field yang memberi approval atau mengubah jawaban siswa. Unknown fields ditolak, bukan dieksekusi.
8. Aplikasi memperlakukan semua teks hasil sebagai teks biasa, bukan HTML atau perintah; tidak mengeksekusi kontennya.

## Aturan tampilan dan penyimpanan

- Impor lengkap yang lolos pemeriksaan struktur tersimpan atomik sebagai satu paket impor dan draft pending. Tidak ada nilai resmi berubah saat impor.
- Item dengan skor numerik dapat menjadi draft pending setelah pemeriksaan snapshot dan konflik. Item `null` tetap terlihat sebagai "Perlu penilaian manual" pada panel review.
- Di review tampilkan jawaban siswa, usulan, diagnosis, flag, dan penilaian resmi yang sudah ada. Dosen dapat mengisi nilai untuk item `null` atau menyunting usulan numerik.
- Approval per kriteria selalu menyimpan nilai dan Catatan Asesor bersama. Approval komponen mencakup semua kriteria pending dalam komponen tersebut; blokir bila ada item tanpa nilai/catatan, snapshot stale, atau konflik.
- Flag bukan larangan otomatis approval: dosen dapat menerima setelah meninjau. Tetap lakukan pemeriksaan stale dan rentang skor di server.
- Jangan menghitung rata-rata final dari rekomendasi yang belum disahkan atau menjadikan `null` sebagai 0. Setelah approval, gunakan perhitungan resmi aplikasi yang sudah berlaku.
- Jika hasil terlalu panjang dan belum utuh, jangan mengimpor potongan. Gabungkan dahulu seluruh hasil menjadi satu objek lengkap, kemudian validasi.

Satu paket hanya dapat diimpor sekali. Ekspor ulang menggantikan paket aktif. Pasangan yang sudah disahkan dipertahankan pada impor; revisi analisis memerlukan ekspor baru.
