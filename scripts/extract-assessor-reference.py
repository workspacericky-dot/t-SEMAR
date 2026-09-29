"""Rebuild anonymous, text-only calibration data from the supplied references."""
import json
import re
from pathlib import Path

import openpyxl
import pdfplumber

root = Path(__file__).resolve().parents[1]
source = root / 'references' / 'tsemar-assessor'


def clean(value):
    return re.sub(r'\s+', ' ', str(value or '')).strip()


interpretations = []
workbook = openpyxl.load_workbook(source / 'interpreting_tsemar_assessor.xlsx', data_only=True)
for sheet in workbook:
    for index, row in enumerate(sheet.iter_rows(values_only=True), 1):
        cells = {openpyxl.utils.get_column_letter(i): v for i, v in enumerate(row, 1) if v is not None}
        if cells:
            interpretations.append({'sheet': sheet.title, 'row': index, 'cells': cells})

grade_rules = []
workbook = openpyxl.load_workbook(root / 'references' / 'Tabel Pengisian Nilai (A s.d. E).xlsx', data_only=True)
section = ''
for row in workbook.active.iter_rows(values_only=True):
    if row[0] and re.match(r'^[ABC]\. ', str(row[0])):
        section = clean(row[0])
    if row[0] in ['AA', 'A', 'BB', 'B', 'CC', 'C', 'D', 'E']:
        grade_rules.append({'perspective': section, 'grade': row[0], 'description': clean(row[2])})

examples = []
for path in sorted(source.glob('Audit_*.pdf')):
    current = None
    with pdfplumber.open(path) as document:
        for page_number, page in enumerate(document.pages, 1):
            for table in page.extract_tables():
                for row in table:
                    if len(row) != 11 or clean(row[0]) == 'No':
                        continue
                    if clean(row[0]).isdigit():
                        current = {'source': path.name, 'pages': [page_number], 'columns': [clean(v) for v in row]}
                        examples.append(current)
                    elif current:
                        current['pages'].append(page_number)
                        for i, value in enumerate(row):
                            if clean(value):
                                current['columns'][i] = clean(current['columns'][i] + ' ' + clean(value))

records = []
for example in examples:
    c = example.pop('columns')
    records.append({**example, 'category': c[1], 'subcategory': c[2], 'criteria': c[3],
                    'auditee_grade': c[4], 'evaluator_grade': c[5], 'note': c[7],
                    'recommendation': c[8], 'teacher_score': float(c[9]), 'assessor_note': c[10]})

target = root / 'src' / 'lib' / 'assessor' / 'reference.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps({'version': '2026-09-29-v1', 'interpretations': interpretations,
                              'grade_rules': grade_rules, 'examples': records}, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Extracted {len(records)} criteria examples and {len(grade_rules)} grade rules.')
