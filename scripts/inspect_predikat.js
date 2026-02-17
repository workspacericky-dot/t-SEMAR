const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../references/Tabel Interpretasi Predikat Penilaian AKIP.xlsx');
const outputPath = path.join(__dirname, '../temp_predikat_output.txt');

try {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    let output = `Sheet: ${sheetName}\n\n`;
    data.forEach(row => {
        output += JSON.stringify(row) + '\n';
    });

    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`Successfully wrote to ${outputPath}`);

} catch (error) {
    console.error('Error:', error.message);
}
