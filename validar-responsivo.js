#!/usr/bin/env node
/**
 * Script de Validação - Pavimento App
 * Verifica integridade HTML/CSS/JS após redesign mobile-first
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;
const FILES = {
  html: path.join(BASE_DIR, 'index.html'),
  css: path.join(BASE_DIR, 'assets', 'css', 'style.css'),
  js: path.join(BASE_DIR, 'assets', 'js', 'script_colaborativo.js'),
};

const REQUIRED_IDS = [
  'map',
  'select-rodovia',
  'btn-rod-clear',
  'rodovia-metadata-card',
  'card-rodovia-nome',
  'card-km-inicial',
  'card-km-final',
  'card-lat-long-inicial',
  'card-lat-long-final',
  'malha-xlsx-table-container',
];

const REQUIRED_CLASSES = [
  'rodovia-filter',
  'filter-select',
  'filter-button',
  'info-card',
  'metadata-card',
  'data-panel',
  'card-header',
  'card-title',
  'table-container',
  'km-grid',
  'km-box',
  'coords-box',
];

const REQUIRED_BREAKPOINTS = [
  '@media (min-width: 768px)',
  '@media (min-width: 1024px)',
  '@media (max-width: 767px)',
  '@media (prefers-color-scheme: dark)',
];

console.log('🔍 Iniciando validação do redesign mobile-first...\n');

let errors = [];
let warnings = [];

// =====================================================
// 1. Validar HTML
// =====================================================
console.log('📄 Validando HTML (index.html)...');
try {
  const html = fs.readFileSync(FILES.html, 'utf8');

  // Verificar IDs obrigatórios
  REQUIRED_IDS.forEach((id) => {
    if (!html.includes(`id="${id}"`)) {
      errors.push(`❌ HTML: ID obrigatório "${id}" não encontrado`);
    }
  });

  // Verificar classes obrigatórias
  REQUIRED_CLASSES.forEach((cls) => {
    if (!html.includes(`class="${cls}"`) && !html.includes(`class="` + cls)) {
      warnings.push(`⚠️  HTML: Classe "${cls}" pode estar faltando (verificar manualmente)`);
    }
  });

  // Verificar atributos ARIA
  if (!html.includes('role="region"')) {
    warnings.push('⚠️  HTML: Atributo role="region" não encontrado (acessibilidade)');
  }
  if (!html.includes('aria-label=')) {
    warnings.push('⚠️  HTML: Atributos aria-label não encontrados (acessibilidade)');
  }

  // Verificar link CSS externo
  if (!html.includes('assets/css/style.css')) {
    errors.push('❌ HTML: Link para style.css não encontrado');
  }

  // Verificar viewport meta tag
  if (!html.includes('viewport')) {
    errors.push('❌ HTML: Meta tag viewport não encontrada');
  }

  console.log('✅ HTML validado\n');
} catch (err) {
  errors.push(`❌ HTML: Erro ao ler arquivo - ${err.message}`);
}

// =====================================================
// 2. Validar CSS
// =====================================================
console.log('🎨 Validando CSS (assets/css/style.css)...');
try {
  const css = fs.readFileSync(FILES.css, 'utf8');

  // Verificar breakpoints
  REQUIRED_BREAKPOINTS.forEach((bp) => {
    if (!css.includes(bp)) {
      errors.push(`❌ CSS: Breakpoint "${bp}" não encontrado`);
    }
  });

  // Verificar classe .rodovia-filter
  if (!css.includes('.rodovia-filter')) {
    errors.push('❌ CSS: Classe .rodovia-filter não encontrada');
  }

  // Verificar mobile-first (base styles antes de media queries)
  const rootPos = css.indexOf('.rodovia-filter {');
  const mediaPos = css.indexOf('@media');
  if (rootPos > mediaPos && mediaPos > 0) {
    warnings.push('⚠️  CSS: Possível ordem incorreta (media queries antes de base styles)');
  }

  // Verificar tamanho (deve ser > 400 linhas)
  const lineCount = css.split('\n').length;
  if (lineCount < 400) {
    warnings.push(`⚠️  CSS: Arquivo muito pequeno (${lineCount} linhas). Verificar se está completo.`);
  } else {
    console.log(`   → ${lineCount} linhas de CSS`);
  }

  // Verificar safe area support
  if (!css.includes('env(safe-area-inset')) {
    warnings.push('⚠️  CSS: Safe area insets não encontrados (suporte a notch)');
  }

  console.log('✅ CSS validado\n');
} catch (err) {
  errors.push(`❌ CSS: Erro ao ler arquivo - ${err.message}`);
}

// =====================================================
// 3. Validar JavaScript
// =====================================================
console.log('⚙️  Validando JavaScript (assets/js/script_colaborativo.js)...');
try {
  const js = fs.readFileSync(FILES.js, 'utf8');

  // Verificar se os selectors usados existem (já validados no HTML)
  const selectors = [
    'getElementById(\'select-rodovia\')',
    'getElementById(\'btn-rod-clear\')',
    'getElementById(\'rodovia-metadata-card\')',
    'getElementById(\'card-rodovia-nome\')',
    'getElementById(\'malha-xlsx-table-container\')',
  ];

  selectors.forEach((sel) => {
    if (!js.includes(sel)) {
      warnings.push(`⚠️  JS: Seletor "${sel}" não encontrado (pode estar refatorado)`);
    }
  });

  console.log('✅ JavaScript validado\n');
} catch (err) {
  errors.push(`❌ JS: Erro ao ler arquivo - ${err.message}`);
}

// =====================================================
// Relatório Final
// =====================================================
console.log('━'.repeat(60));
console.log('📊 RELATÓRIO DE VALIDAÇÃO\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ Validação APROVADA - Nenhum erro encontrado\n');
  console.log('Próximos passos:');
  console.log('  1. Abrir index.html no navegador');
  console.log('  2. F12 → DevTools → Toggle device toolbar (Ctrl+Shift+M)');
  console.log('  3. Testar em: iPhone SE, iPad, Desktop (1920px)');
  console.log('  4. Verificar console para erros JS\n');
} else {
  if (errors.length > 0) {
    console.log(`❌ Erros encontrados (${errors.length}):\n`);
    errors.forEach((err) => console.log(`  ${err}`));
    console.log();
  }
  if (warnings.length > 0) {
    console.log(`⚠️  Avisos (${warnings.length}):\n`);
    warnings.forEach((warn) => console.log(`  ${warn}`));
    console.log();
  }
}

console.log('━'.repeat(60));

// Exit code
process.exit(errors.length > 0 ? 1 : 0);
