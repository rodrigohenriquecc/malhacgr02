#!/usr/bin/env node
// Converte um arquivo Excel (.xlsx) para CSV (delimitador ';')
// Usage: node scripts/convert_excel.js [input.xlsx] [output.csv]

import fs from 'fs';
import path from 'path';
import process from 'process';
import XLSX from 'xlsx';

const argv = process.argv.slice(2);
const input = argv[0] || 'assets/data/PLANILHA BI - OFICIAL - Mapa CGR02.xlsx';
const output = argv[1] || 'assets/data/PLANILHA BI - OFICIAL.csv';

function fileExists(p) {
  try { return fs.existsSync(p); } catch (e) { return false; }
}

if (!fileExists(input)) {
  console.error(`Arquivo de entrada não encontrado: ${input}`);
  process.exit(2);
}

try {
  console.log(`Lendo ${input} ...`);
  const wb = XLSX.readFile(input, { cellDates: true });
  const sheetNames = wb.SheetNames || [];
  if (!sheetNames.length) {
    console.error('Nenhuma planilha encontrada no arquivo Excel.');
    process.exit(3);
  }
  const sheet = wb.Sheets[sheetNames[0]];
  // Export as CSV using semicolon as field separator
  const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ';' });
  // Ensure output directory exists
  const outDir = path.dirname(output);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(output, csv, 'utf8');
  console.log(`Arquivo CSV gerado: ${output}`);

  // Quick validation: check for expected headers
  const firstLine = csv.split('\n')[0] || '';
  const headers = firstLine.split(';').map(h => h.trim().toUpperCase());
  const expected = ['RC','SP','KM','LOCALIZAÇÃO','MUNICÍPIO','MUNICIPIO','TIPO'];
  const found = expected.some(e => headers.includes(e));
  if (!found) {
    console.warn('Aviso: não detectei nenhum dos cabeçalhos esperados (RC, SP, KM, LOCALIZAÇÃO, MUNICÍPIO, TIPO).');
    console.warn(`Cabeçalhos detectados: ${headers.join(', ')}`);
  } else {
    console.log('Cabeçalhos verificados (parecem OK).');
  }
  console.log('Conversão finalizada com sucesso.');
} catch (err) {
  console.error('Erro ao converter Excel:', err);
  process.exit(1);
}
