import { mkdir, readFile, writeFile } from 'node:fs/promises';
const source = new URL('../references/tsemar-assessor/chatgpt-workflow/', import.meta.url);
const destination = new URL('../public/assessor-chatgpt/', import.meta.url);
await mkdir(destination, { recursive: true });
// Historical calibration is linked from the authorized GitHub publication, not copied to site assets.
for (const name of ['PROJECT_INSTRUCTIONS.md', 'KNOWLEDGE.md', 'OUTPUT_CONTRACT.md', 'output.schema.json', 'CALIBRATION_SYNTHETIC.json', 'PROMPTS.md']) {
    await writeFile(new URL(name, destination), await readFile(new URL(name, source)));
}
const prompts = await readFile(new URL('PROMPTS.md', source), 'utf8');
const analysis = prompts.split('## 2.')[1].split('```text\n')[1].split('```')[0].trim();
await writeFile(new URL('ANALYSIS_PROMPT.txt', destination), analysis + '\n');
