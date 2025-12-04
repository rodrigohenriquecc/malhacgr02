#!/usr/bin/env node

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

// Definição dos esquemas de validação para cada CSV
const schemas = {
  'linhas_por_trecho.csv': {
    headers: ['rodovia', 'km_inicial', 'km_final', 'cor', 'espessura'],
    types: {
      rodovia: 'string',
      km_inicial: 'number',
      km_final: 'number', 
      cor: 'string',
      espessura: 'number'
    },
    required: ['rodovia', 'km_inicial', 'km_final', 'cor', 'espessura']
  },
  'mapa_de_calor.csv': {
    headers: ['rodovia', 'km_inicial', 'km_final'],
    types: {
      rodovia: 'string',
      km_inicial: 'number',
      km_final: 'number'
    },
    required: ['rodovia', 'km_inicial', 'km_final']
  },
  'pontos_de_interesse.csv': {
    headers: ['rodovia', 'km', 'obs', 'cor', 'opacidade', 'raio'],
    types: {
      rodovia: 'string',
      km: 'number',
      obs: 'string',
      cor: 'string',
      opacidade: 'number',
      raio: 'number'
    },
    required: ['rodovia', 'km', 'obs', 'cor', 'opacidade', 'raio']
  }
};

/**
 * Valida se um valor corresponde ao tipo esperado
 */
function validateType(value, expectedType, fieldName) {
  if (expectedType === 'number') {
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new Error(`Campo '${fieldName}' deve ser um número, recebido: '${value}'`);
    }
    return num;
  }
  
  if (expectedType === 'string') {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Campo '${fieldName}' deve ser uma string não vazia, recebido: '${value}'`);
    }
    return value.trim();
  }
  
  return value;
}

/**
 * Valida um arquivo CSV específico
 */
function validateCSV(filename) {
  console.log(`🔍 Validando ${filename}...`);
  
  const schema = schemas[filename];
  if (!schema) {
    throw new Error(`Esquema não definido para o arquivo: ${filename}`);
  }
  
  let content;
  try {
    content = readFileSync(join(dataDir, filename), 'utf-8');
  } catch (error) {
    throw new Error(`Erro ao ler arquivo ${filename}: ${error.message}`);
  }
  
  let records;
  try {
    records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  } catch (error) {
    throw new Error(`Erro ao parsear CSV ${filename}: ${error.message}`);
  }
  
  if (records.length === 0) {
    throw new Error(`Arquivo ${filename} está vazio ou não possui dados`);
  }
  
  // Validar cabeçalhos
  const actualHeaders = Object.keys(records[0]);
  const expectedHeaders = schema.headers;
  
  if (actualHeaders.length !== expectedHeaders.length) {
    throw new Error(`${filename}: Número incorreto de colunas. Esperado: ${expectedHeaders.length}, encontrado: ${actualHeaders.length}`);
  }
  
  for (let i = 0; i < expectedHeaders.length; i++) {
    if (actualHeaders[i] !== expectedHeaders[i]) {
      throw new Error(`${filename}: Cabeçalho incorreto na posição ${i + 1}. Esperado: '${expectedHeaders[i]}', encontrado: '${actualHeaders[i]}'`);
    }
  }
  
  // Validar cada linha
  records.forEach((record, lineIndex) => {
    const lineNum = lineIndex + 2; // +2 porque: +1 para base 1, +1 para cabeçalho
    
    // Verificar campos obrigatórios
    schema.required.forEach(field => {
      if (!(field in record) || record[field] === undefined || record[field] === '') {
        throw new Error(`${filename}:${lineNum}: Campo obrigatório '${field}' está vazio`);
      }
    });
    
    // Validar tipos
    Object.entries(schema.types).forEach(([field, expectedType]) => {
      if (field in record) {
        try {
          validateType(record[field], expectedType, field);
        } catch (error) {
          throw new Error(`${filename}:${lineNum}: ${error.message}`);
        }
      }
    });
    
    // Validações específicas por arquivo
    if (filename === 'linhas_por_trecho.csv') {
      const kmInicial = parseFloat(record.km_inicial);
      const kmFinal = parseFloat(record.km_final);
      if (kmInicial >= kmFinal) {
        throw new Error(`${filename}:${lineNum}: km_inicial (${kmInicial}) deve ser menor que km_final (${kmFinal})`);
      }
      
      const espessura = parseFloat(record.espessura);
      if (espessura <= 0 || espessura > 10) {
        throw new Error(`${filename}:${lineNum}: espessura deve estar entre 1 e 10, recebido: ${espessura}`);
      }
      
      if (!record.cor.match(/^#[0-9A-Fa-f]{6}$/)) {
        throw new Error(`${filename}:${lineNum}: cor deve estar no formato hexadecimal (#RRGGBB), recebido: '${record.cor}'`);
      }
    }
    
    if (filename === 'mapa_de_calor.csv') {
      const kmInicial = parseFloat(record.km_inicial);
      const kmFinal = parseFloat(record.km_final);
      if (kmInicial >= kmFinal) {
        throw new Error(`${filename}:${lineNum}: km_inicial (${kmInicial}) deve ser menor que km_final (${kmFinal})`);
      }
    }
    
    if (filename === 'pontos_de_interesse.csv') {
      const opacidade = parseFloat(record.opacidade);
      if (opacidade < 0 || opacidade > 1) {
        throw new Error(`${filename}:${lineNum}: opacidade deve estar entre 0 e 1, recebido: ${opacidade}`);
      }
      
      const raio = parseFloat(record.raio);
      if (raio <= 0 || raio > 1000) {
        throw new Error(`${filename}:${lineNum}: raio deve estar entre 1 e 1000, recebido: ${raio}`);
      }
      
      if (!record.cor.match(/^#[0-9A-Fa-f]{6}$/)) {
        throw new Error(`${filename}:${lineNum}: cor deve estar no formato hexadecimal (#RRGGBB), recebido: '${record.cor}'`);
      }
    }
  });
  
  console.log(`✅ ${filename} validado com sucesso (${records.length} registros)`);
  return records.length;
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando validação dos CSVs...\n');
  
  let totalRecords = 0;
  let errors = [];
  
  for (const filename of Object.keys(schemas)) {
    try {
      const recordCount = validateCSV(filename);
      totalRecords += recordCount;
    } catch (error) {
      errors.push(error.message);
      console.error(`❌ ${error.message}`);
    }
  }
  
  console.log(`\n📊 Resumo da validação:`);
  console.log(`   Total de registros processados: ${totalRecords}`);
  console.log(`   Arquivos com erro: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log(`\n💥 Erros encontrados:`);
    errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
    
    console.log(`\n🔧 Para corrigir os erros:`);
    console.log(`   1. Abra os arquivos CSV em um editor`);
    console.log(`   2. Corrija os problemas listados acima`);
    console.log(`   3. Execute novamente: npm run validate`);
    
    process.exit(1);
  }
  
  console.log(`\n🎉 Todos os CSVs estão válidos!`);
  process.exit(0);
}

// Executar apenas se este arquivo for chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(`💥 Erro inesperado: ${error.message}`);
    process.exit(1);
  });
}
