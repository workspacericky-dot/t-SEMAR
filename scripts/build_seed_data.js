const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configuration matches the analyzed Excel structure
const FILE_CRITERIA = path.join(process.cwd(), 'references', 'Tabel Kriteria Evaluasi AKIP MA RI.xlsx');
const FILE_SKOR = path.join(process.cwd(), 'references', 'Tabel Skor Penilaian Evaluasi AKIP.xlsx');
const OUTPUT_FILE = path.join(process.cwd(), 'src', 'lib', 'data', 'criteria.ts');

function parseSkor() {
    console.log('Parsing Skor file...');
    const workbook = XLSX.readFile(FILE_SKOR);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Map: Component Name -> [Sub1_Weight, Sub2_Weight, Sub3_Weight]
    // Row 0 is header. Row 1+ are data.
    // Col 0: Component Name
    // Col 1: Sub 1 % (e.g., 6)
    // Col 2: Sub 2 % (e.g., 9)
    // Col 3: Sub 3 % (e.g., 15)

    const weights = {};

    rows.slice(1).forEach(row => {
        if (!row[0]) return;
        const componentName = row[0].replace(/^[0-9]+\.\s*/, '').trim(); // Remove "1. " prefix if any

        // Handle variations in naming if necessary. 
        // For now assume exact match or simple prefix removal.

        weights[componentName] = [
            typeof row[1] === 'number' ? row[1] : 0,
            typeof row[2] === 'number' ? row[2] : 0,
            typeof row[3] === 'number' ? row[3] : 0,
        ];
    });

    return weights;
}

function parseCriteria(weightsMap) {
    console.log('Parsing Criteria file...');
    const workbook = XLSX.readFile(FILE_CRITERIA);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Hierarchy reconstruction
    const finalData = [];

    let currentComponent = null;
    let currentSubComponent = null;
    let subComponentIndex = -1; // 0, 1, 2 for the 3 subweights

    // Starting from row 1 (exclude header row 0)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const colComponent = row[0];
        const colSub = row[1];
        const colCriteria = row[2];

        // 1. Detect Component change (Merged cell logic: value is only in first row)
        if (colComponent) {
            currentComponent = colComponent.trim();
            subComponentIndex = -1; // Reset sub index
            currentSubComponent = null;
        }

        // 2. Detect Sub-Component change
        if (colSub) {
            currentSubComponent = colSub.trim();
            subComponentIndex++;
        }

        // 3. Process Criteria
        if (colCriteria) {
            // Determine weights
            // Normalize component name to match weightsMap key
            const cleanComponentName = currentComponent ? currentComponent.replace(/^[0-9]+\.\s*/, '').trim() : '';

            // Special case for "Perencanaan Kinerja" vs "1. Perencanaan Kinerja"
            // Let's try to find fuzzy match
            let componentWeights = weightsMap[cleanComponentName] || [0, 0, 0];

            // If not found, try to look for substring or loose match
            if (!weightsMap[cleanComponentName]) {
                const key = Object.keys(weightsMap).find(k => k.includes(cleanComponentName) || cleanComponentName.includes(k));
                if (key) componentWeights = weightsMap[key];
            }

            const subWeightTotal = componentWeights[subComponentIndex] || 0;

            // We need to count how many criteria are in this specific sub-component to divide the weight.
            // But we are streaming rows. So we can't look ahead easily.
            // Strategy: Collect all rows first, grouping them, then calculate weights.

            finalData.push({
                category: currentComponent,
                subcategory: currentSubComponent,
                criteria: colCriteria.trim(),
                subWeightTotal: subWeightTotal,
                // We'll calculate 'bobot' later
            });
        }
    }

    // Now grouping to calculate individual weights
    // Group by category+subcategory
    const groups = {};
    finalData.forEach(item => {
        const key = `${item.category}|||${item.subcategory}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
    });

    // Calculate and assign
    const items = [];
    let sortOrder = 0;

    for (const key in groups) {
        const groupItems = groups[key];
        const count = groupItems.length;
        if (count === 0) continue;

        const subCategoryWeight = groupItems[0].subWeightTotal;
        // Bobot per item is relative percentage within subcategory (sums to 100 ideally, or 1)
        // User requested: Sub-skor = SumProduct(Nilai, Bobot)
        // If Nilai is 0-100, and we want Sub-skor to be 0-100, Bobot should sum to 1.
        // But numeric(5,2) in DB suggests we might want standard numbers. 
        // Let's use 100/count (percentage share). 
        // Then SubSkor = Sum(Nilai * Bobot / 100).
        const relativeWeight = 100 / count;

        // We also need Category Weight. 
        // We can sum subCategoryWeights for the category? 
        // Or we rely on the map.
        // Let's fetch category total weight from `weights` structure if possible, but we parsing rows.
        // We can just rely on the SubCategoryWeight being correct (6, 9, 15).

        groupItems.forEach((item, idx) => {
            items.push({
                category: item.category,
                subcategory: item.subcategory,
                criteria: item.criteria,
                bobot: Number(relativeWeight.toFixed(2)), // Relative weight (e.g. 14.29)
                category_bobot: 0, // Placeholder, calculated below if needed, but maybe not stored per item
                subcategory_bobot: subCategoryWeight, // The weight of the subcategory (e.g. 6)
                sort_order: sortOrder++
            });
        });
    }

    // Post-process to fill category_bobot
    const catWeights = {};
    items.forEach(i => {
        if (!catWeights[i.category]) catWeights[i.category] = 0;
        // We can't simply sum because items are duplicated subcats. 
        // But we know subcategory_bobot is same for all items in subcat.
    });

    // Better: Derive category weight from weightsMap (parseSkor result)
    // weightsMap structure: { "Perencanaan Kinerja": [6, 9, 15] }
    // Sum is 30.

    items.forEach(item => {
        // Find raw component name
        const cleanName = item.category.replace(/^[0-9]+\.\s*/, '').trim();
        // Fuzzy match logic again
        let w = weightsMap[cleanName];
        if (!w) {
            const key = Object.keys(weightsMap).find(k => k.includes(cleanName) || cleanName.includes(k));
            if (key) w = weightsMap[key];
        }

        if (w) {
            item.category_bobot = w.reduce((a, b) => a + b, 0);
        }
    });

    return items;
}

try {
    const weights = parseSkor();
    console.log('Weights Map:', weights);

    const items = parseCriteria(weights);
    console.log(`Generated ${items.length} criteria items.`);

    // Write TS file
    const fileContent = `// Auto-generated from Excel files
// Defines the hierarchy and weights for t-SEMAR audit

export interface CriteriaTemplate {
    category: string;
    subcategory: string;
    criteria: string;
    bobot: number;
    category_bobot: number;
    subcategory_bobot: number;
    sort_order: number;
}

export const AUDIT_CRITERIA_TEMPLATE: CriteriaTemplate[] = ${JSON.stringify(items, null, 2)};
`;

    fs.writeFileSync(OUTPUT_FILE, fileContent);
    console.log(`Successfully wrote to ${OUTPUT_FILE}`);

} catch (e) {
    console.error('Error:', e);
}
