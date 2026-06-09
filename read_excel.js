const xlsx = require('xlsx');
const wb = xlsx.readFile('../../../Copy of REZUM TALCO.xlsx');
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];
console.log('Columns:', xlsx.utils.sheet_to_json(sheet, {header: 1})[0]);
console.log('Row 1:', xlsx.utils.sheet_to_json(sheet)[0]);
