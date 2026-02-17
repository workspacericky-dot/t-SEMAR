const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const files = [
    'references/Tabel Pengisian Nilai (A s.d. E).xlsx',
    'references/Tabel Skor Penilaian Evaluasi AKIP.xlsx'
];

const allData = {};

files.forEach(file => {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
        console.log(`Reading ${file}`);
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        allData[path.basename(file)] = data;
    } else {
        console.log(`File not found: ${filePath}`);
    }
});

fs.writeFileSync('temp_scoring_output_utf8.txt', JSON.stringify(allData, null, 2), 'utf8');
console.log('Done writing utf8 output.');
