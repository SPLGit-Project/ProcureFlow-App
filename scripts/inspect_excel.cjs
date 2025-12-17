
const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../Resources/products.xlsx');

try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
  
  console.log("EXCEL HEADERS FOUND:");
  console.log(JSON.stringify(headers, null, 2));
} catch (error) {
  console.error("Error reading file:", error.message);
}
