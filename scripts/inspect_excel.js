
import { createRequire } from 'module';
import * as path from 'path';
import * as fs from 'fs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const filePath = path.join(process.cwd(), 'Resources', 'MKY-PO tracking July 2025_Current.xlsx');

console.log(`Reading file: ${filePath}`);

try {
    if (!fs.existsSync(filePath)) {
        console.error('File not found at path: ' + filePath);
        process.exit(1);
    }

    const workbook = XLSX.readFile(filePath);
    console.log('Workbook read successfully.');
    console.log('Sheet Names:', workbook.SheetNames);

    if (workbook.SheetNames.length > 0) {
        const firstSheetName = workbook.SheetNames[0];
        console.log(`Inspecting first sheet: ${firstSheetName}`);
        const worksheet = workbook.Sheets[firstSheetName];

        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (json.length > 0) {
            const dumpPath = path.join(process.cwd(), 'scripts', 'excel_dump.json');
            const output = {
                headers: json[0],
                sample: json.slice(1, 6)
            };
            fs.writeFileSync(dumpPath, JSON.stringify(output, null, 2));
            console.log(`Dump written to ${dumpPath}`);
        } else {
            console.log('Sheet appears empty.');
        }
    }
} catch (error) {
    console.error('An error occurred:', error);
}
