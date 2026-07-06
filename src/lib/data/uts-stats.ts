// Snapshot of UTS (Ujian Tengah Semester) final-score statistics for the
// public statistics dashboard. Source: input-file/dashboard_UTS.xlsx
// (Nilai_UTS!F2:F60, 59 peserta, komponen Perencanaan Kinerja, 2026).

export const UTS_SUMMARY = {
    n: 59,
    mean: 70.00,
    median: 69.98,
    stdDev: 9.66,
    min: 34.61,
    q1: 63.01,
    q3: 77.51,
    max: 90.01,
};

export const UTS_SCORE_RANGES = [
    { label: '30–40', min: 30, max: 40, count: 1 },
    { label: '40–50', min: 40, max: 50, count: 0 },
    { label: '50–60', min: 50, max: 60, count: 7 },
    { label: '60–70', min: 60, max: 70, count: 22 },
    { label: '70–80', min: 70, max: 80, count: 19 },
    { label: '80–90', min: 80, max: 90, count: 9 },
    { label: '90–100', min: 90, max: 100, count: 1 },
];

export const UTS_GRADE_DISTRIBUTION = [
    { label: 'E', count: 1 },
    { label: 'D', count: 0 },
    { label: 'C', count: 18 },
    { label: 'B', count: 20 },
    { label: 'B+', count: 17 },
    { label: 'A-', count: 2 },
    { label: 'A', count: 1 },
];

// All 59 individual final scores, anonymized (no participant names), sorted ascending.
export const UTS_RAW_SCORES = [
    34.61, 55.41, 57.21, 58.18, 58.41, 58.42, 59.61, 59.81, 60.22, 61.22,
    61.61, 61.62, 62.41, 62.61, 62.81, 63.21, 64.01, 64.42, 64.81, 65.81,
    66.21, 66.41, 66.82, 67.02, 67.41, 67.73, 69.01, 69.21, 69.62, 69.98,
    70.21, 70.22, 70.62, 70.81, 70.82, 71.22, 71.81, 73.01, 74.02, 75.01,
    75.21, 76.61, 77.02, 77.22, 77.81, 77.81, 78.62, 79.02, 79.41, 80.21,
    81.49, 81.82, 82.02, 83.02, 83.22, 83.42, 85.22, 87.21, 90.01,
];
