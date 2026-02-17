const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

try {
    const filePath = path.join(process.cwd(), 'references', 'Tabel Kriteria Evaluasi AKIP MA RI.xlsx');
    const outputPath = path.join(process.cwd(), 'temp_inspection.txt');

    let output = `Reading file: ${filePath}\n`;

    if (!fs.existsSync(filePath)) {
        output += 'File not found!\n';
        fs.writeFileSync(outputPath, output);
        process.exit(1);
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Array of arrays

    output += 'First 50 rows of Criteria (Sheet 1):\n';
    data.slice(0, 50).forEach((row, i) => {
        output += `Row ${i}: ${JSON.stringify(row)}\n`;
    });

    // Check second file
    const filePathSkor = path.join(process.cwd(), 'references', 'Tabel Skor Penilaian Evaluasi AKIP.xlsx');
    if (fs.existsSync(filePathSkor)) {
        const wb2 = XLSX.readFile(filePathSkor);
        const ws2 = wb2.Sheets[wb2.SheetNames[0]];
        const data2 = XLSX.utils.sheet_to_json(ws2, { header: 1 });
        output += '\nFirst 20 rows of Skor File:\n';
        data2.slice(0, 20).forEach((row, i) => {
            output += `Row ${i}: ${JSON.stringify(row)}\n`;
        });
    }

    fs.writeFileSync(outputPath, output);
    console.log('Output written to temp_inspection.txt');

} catch (error) {
    console.error('Error:', error);
}
