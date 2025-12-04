/* global L, JSZip, shp, turf, Papa, toGeoJSON */

console.log("🗺️ DR.02 - Sistema Colaborativo carregado (v2.0)");

// ═══════════════════════ 1) Inicialização do Mapa
const mapa = L.map("map").setView([-23.8, -48.5], 7);
window.mapa = mapa;

// Criação de panes para melhor organização das camadas
["shapefilePane", "rodoviasPane", "overlayPane", "markerPane"].forEach((p, i) => {
  mapa.createPane(p).style.zIndex = 400 + i * 50;
  if (i < 2) mapa.getPane(p).style.pointerEvents = "none";
});

// Camada base do mapa
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap | DR.02 Sistema Colaborativo",
}).addTo(mapa);

// ═══════════════════════ 2) Variáveis Globais
const layers = {
  linhas: L.layerGroup([], { pane: "rodoviasPane" }).addTo(mapa)
};

// ═══════════════════════ 2.1) Dados km a km da malha oficial
let pontosMalhaOficial = [];
let indexMalhaOficial = {};

/**
 * Carrega PLANILHA BI - OFICIAL.csv e indexa por rodovia e km
 */
async function carregarMalhaOficial() {
  try {
    // tenta carregar o CSV gerado (podendo vir do convert_excel.js)
    const possiblePaths = [
      'assets/data/PLANILHA BI - OFICIAL.csv',
      'assets/data/PLANILHA BI - OFICIAL - Mapa CGR02.csv',
      'assets/data/PLANILHA BI - OFICIAL - Mapa CGR02.xlsx'
    ];
    let csvText = null;
    let lastErr = null;
    for (const p of possiblePaths) {
      try {
        const resp = await fetch(p);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        // if it's xlsx, we skip (convert script should generate csv)
        const isXlsx = p.toLowerCase().endsWith('.xlsx');
        if (isXlsx) {
          // can't parse xlsx here; skip and continue
          continue;
        }
        csvText = await resp.text();
        console.log(`ℹ️ Carregando malha oficial de: ${p}`);
        break;
      } catch (err) {
        lastErr = err;
        // tenta o próximo
      }
    }

    if (!csvText) {
      throw lastErr || new Error('Arquivo PLANILHA BI - OFICIAL não encontrado');
    }

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';',
        transform: (value) => (value === undefined || value === null) ? '' : String(value).trim(),
        complete: (results) => {
          pontosMalhaOficial = results.data || [];
          indexMalhaOficial = {};

          // helper: normaliza chave (remove acentos, uppercase, remove spaces)
          const normalizeKey = (s) => {
            if (!s && s !== 0) return '';
            try { return String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim(); }
            catch (e) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
          };

          // For each row, detect fields tolerantly
          pontosMalhaOficial.forEach((row, idx) => {
            try {
              const keys = Object.keys(row || {});
              const kmap = {};
              keys.forEach(k => { kmap[k.toUpperCase().replace(/\s+/g,'')] = k; });

              // candidates for rodovia (SP column)
              const rodCandidates = ['SP','RODOVIA','RODOVIAS','ROD','RODOVIA/','RODOVIA'];
              let rodovia = null;
              for (const c of rodCandidates) {
                const kk = Object.keys(kmap).find(x => x.includes(c));
                if (kk) { rodovia = row[kmap[kk]]; break; }
              }
              if (!rodovia) {
                // try any key containing 'SP ' or starting with 'SP'
                const kk = Object.keys(kmap).find(x => x.startsWith('SP') || x.includes('SP')); if (kk) rodovia = row[kmap[kk]];
              }
              if (!rodovia) return; // can't index without rodovia
              rodovia = normalizeKey(rodovia).toString();

              // km candidates: any key that contains 'KM'
              const kmKey = Object.keys(kmap).find(x => x.includes('KM'));
              let kmRaw = kmKey ? row[kmap[kmKey]] : null;
              // some sheets may use 'KM ' or 'KM_INICIAL' etc.
              if (!kmRaw) {
                const alt = Object.keys(kmap).find(x => /^(KMINICIAL|KM_INICIAL|KMINICIO|KM$)/.test(x));
                if (alt) kmRaw = row[kmap[alt]];
              }
              if (!kmRaw) return;
              // normalize km string: replace comma with dot for parseFloat and keep original forms
              let kmStr = String(kmRaw).trim();
              kmStr = kmStr.replace(/\s+/g, '');
              // ensure decimal separator dot for parsing
              const kmDot = kmStr.replace(',', '.');
              const km = parseFloat(kmDot);
              if (isNaN(k)) return;

              // location candidates
              const locKey = Object.keys(kmap).find(x => x.includes('LOCAL') || x.includes('LOCALIZACAO') || x.includes('LOCALIZA') || x.includes('LOCATION'));
              let localizacao = locKey ? row[kmap[locKey]] : '';
              // if not present, try LAT and LNG separate
              if ((!localizacao || String(localizacao).trim() === '') ) {
                const latK = Object.keys(kmap).find(x => x.includes('LAT'));
                const lngK = Object.keys(kmap).find(x => x.includes('LON') || x.includes('LONG') || x.includes('LNG'));
                if (latK && lngK) {
                  const lat = row[kmap[latK]]; const lng = row[kmap[lngK]];
                  if (lat !== undefined && lng !== undefined) localizacao = `${String(lat).trim()}, ${String(lng).trim()}`;
                }
              }

              // municipality candidate (optional)
              const munKey = Object.keys(kmap).find(x => x.includes('MUNICIP') || x.includes('MUNICIPIO'));
              const municipio = munKey ? row[kmap[munKey]] : '';

              // Prepare index
              if (!indexMalhaOficial[rodovia]) indexMalhaOficial[rodovia] = {};
              // store row with normalized fields to help later lookups
              const stored = Object.assign({}, row);
              stored.SP = rodovia;
              stored.KM = kmDot; // dot decimal
              stored.KM_RAW = kmStr;
              stored.LOCALIZACAO = localizacao ? String(localizacao).trim() : '';
              stored.MUNICIPIO = municipio || stored.MUNICIPIO || stored.MUNICÍPIO || '';
              // store under km string keys (both dot and comma variants)
              const keyDot = String(kmDot);
              const keyComma = keyDot.replace('.', ',');
              indexMalhaOficial[rodovia][keyDot] = stored;
              indexMalhaOficial[rodovia][keyComma] = stored;
            } catch (e) {
              console.debug('Erro processando linha da malha oficial', e, row, idx);
            }
          });

          console.log(`✅ PLANILHA BI - OFICIAL carregada: ${pontosMalhaOficial.length} linhas; rodovias indexadas: ${Object.keys(indexMalhaOficial).length}`);
          resolve();
        },
        error: (error) => {
          console.error('❌ Erro no parsing da PLANILHA BI - OFICIAL:', error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error('❌ Erro ao carregar PLANILHA BI - OFICIAL:', error);
    throw error;
  }
}

// Variáveis para shapefiles
const rcLayers = {};
const rodLayers = {};
// guarda estilos padrão das rodovias (para restaurar quando filtros são limpos)
const rodLayerDefaults = {};
// Índice de metadados das rodovias extraídas do KMZ (normalizado -> info)
const rodLayerIndex = {};
// expõe globalmente para filtros
window.rodLayerIndex = rodLayerIndex;
window.rodLayerDefaults = rodLayerDefaults;

let dados = {
  linhasPorTrecho: []
};

// ═══════════════════════ 3) URLs dos CSVs do Google Drive
const CSV_URLS = {
  // URLs públicas do Google Drive
  linhasPorTrecho: 'https://docs.google.com/spreadsheets/d/185vR8JQ_j93G8WWRSLiVyvAZHWrh6HJP/export?format=csv'
};

// ═══════════════════════ 4) Sistema de Coordenadas Reais

/**
 * Dados de metadados das rodovias carregados do meta.csv
 */
let metadadosRodovias = {};

/**
 * Carrega o arquivo meta.csv com coordenadas reais das rodovias
 */
async function carregarMetadadosRodovias() {
  console.log("📊 Carregando metadados das rodovias (meta.csv)...");
  
  try {
    const response = await fetch('assets/data/meta.csv');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transform: (value) => value.trim(),
        complete: (results) => {
          metadadosRodovias = {};
          
          results.data.forEach((row, index) => {
            try {
              const rodovia = row.Rodovia?.trim();
              const kmInicialStr = row['Km Inicial']?.replace(',', '.');
              const kmFinalStr = row['Km Final']?.replace(',', '.');
              const coordInicialStr = row['Lat e Long km Inicial'];
              const coordFinalStr = row['Lat e Long km final'];
              
              if (!rodovia || !kmInicialStr || !kmFinalStr || !coordInicialStr || !coordFinalStr) {
                return;
              }
              
              const kmInicial = parseFloat(kmInicialStr);
              const kmFinal = parseFloat(kmFinalStr);
              
              // Parse coordenadas iniciais (formato: "-23.415050, -48.043810")
              const [latInicial, lngInicial] = coordInicialStr.split(',').map(c => parseFloat(c.trim()));
              const [latFinal, lngFinal] = coordFinalStr.split(',').map(c => parseFloat(c.trim()));
              
              if (isNaN(kmInicial) || isNaN(kmFinal) || isNaN(latInicial) || isNaN(lngInicial) || isNaN(latFinal) || isNaN(lngFinal)) {
                console.warn(`⚠️ Dados inválidos na linha ${index + 2}: ${rodovia}`);
                return;
              }
              
              if (!metadadosRodovias[rodovia]) {
                metadadosRodovias[rodovia] = [];
              }
              
              metadadosRodovias[rodovia].push({
                kmInicial,
                kmFinal,
                coordInicial: { lat: latInicial, lng: lngInicial },
                coordFinal: { lat: latFinal, lng: lngFinal }
              });
              
            } catch (error) {
              console.error(`❌ Erro ao processar linha ${index + 2}:`, error, row);
            }
          });
          
          // Ordena trechos por km inicial para facilitar interpolação
          Object.values(metadadosRodovias).forEach(trechos => {
            trechos.sort((a, b) => a.kmInicial - b.kmInicial);
          });
          
          console.log(`✅ Metadados carregados: ${Object.keys(metadadosRodovias).length} rodovias`);
          console.log("📍 Rodovias disponíveis:", Object.keys(metadadosRodovias));
          resolve(metadadosRodovias);
        },
        error: (error) => {
          console.error("❌ Erro no parsing do meta.csv:", error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error("❌ Erro ao carregar meta.csv:", error);
    throw error;
  }
}

/**
 * Calcula coordenadas reais baseadas na rodovia e quilometragem
 * @param {string} rodovia - Nome da rodovia (ex: "SP 270 Vang")
 * @param {number} km - Quilometragem desejada
 * @returns {Object|null} - {lat, lng} ou null se não encontrado
 */
function obterCoordenadaReal(rodovia, km) {
  // Tenta buscar na PLANILHA BI - OFICIAL para máxima precisão
  if (indexMalhaOficial[rodovia]) {
    // Tenta correspondência exata, e se não houver, tenta interpolar
    const rodIndex = indexMalhaOficial[rodovia];
    const tryGetPonto = (k) => {
      const keyComma = k.toString().replace('.', ',');
      return rodIndex[keyComma] || rodIndex[k.toString()];
    };

    // tentativa exata
    let ponto = tryGetPonto(km);
    if (!ponto) {
      // tenta arredondamento simples
      ponto = tryGetPonto(parseFloat(km.toFixed(1)));
    }

    if (!ponto) {
      // tenta interpolação linear entre os kms disponíveis mais próximos
      const kmsArr = Object.keys(rodIndex)
        .map(k => parseFloat(k.replace(',', '.')))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);

      if (kmsArr.length) {
        // encontra menores e maiores
        let lower = null, upper = null;
        for (let i = 0; i < kmsArr.length; i++) {
          const val = kmsArr[i];
          if (val <= km) lower = val;
          if (val >= km && upper === null) upper = val;
        }
        if (lower !== null && upper !== null && lower !== upper) {
          const pLower = tryGetPonto(lower);
          const pUpper = tryGetPonto(upper);
          if (pLower && pUpper && pLower.LOCALIZAÇÃO && pUpper.LOCALIZAÇÃO) {
            const [latL, lngL] = pLower.LOCALIZAÇÃO.split(',').map(c => parseFloat(c.trim()));
            const [latU, lngU] = pUpper.LOCALIZAÇÃO.split(',').map(c => parseFloat(c.trim()));
            if (!isNaN(latL) && !isNaN(lngL) && !isNaN(latU) && !isNaN(lngU)) {
              const t = (km - lower) / (upper - lower);
              const lat = latL + (latU - latL) * t;
              const lng = lngL + (lngU - lngL) * t;
              return { lat, lng };
            }
          }
        }

        // fallback: escolhe o km mais próximo
        const kmMaisProx = kmsArr.reduce((prev, curr) => Math.abs(curr - km) < Math.abs(prev - km) ? curr : prev, kmsArr[0]);
        ponto = tryGetPonto(kmMaisProx);
      }
    }

    if (ponto && ponto.LOCALIZAÇÃO) {
      const [lat, lng] = ponto.LOCALIZAÇÃO.split(',').map(c => parseFloat(c.trim()));
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng, ponto };
      }
    }
  }
  // Fallback: sistema antigo
  // ...existing code...
  if (!metadadosRodovias[rodovia]) {
    const rodoviaLimpa = rodovia.replace(/ Vang| Jon| Madri| Obragen| Ellenco| Vale/g, '').trim();
    const possiveisNomes = Object.keys(metadadosRodovias).filter(r => 
      r.includes(rodoviaLimpa) || rodoviaLimpa.includes(r.split(' ')[0] + ' ' + r.split(' ')[1])
    );
    if (possiveisNomes.length === 0) {
      console.warn(`⚠️ Rodovia não encontrada nos metadados: ${rodovia}`);
      return null;
    }
    rodovia = possiveisNomes[0];
  }
  const trechos = metadadosRodovias[rodovia];
  if (!trechos || trechos.length === 0) return null;
  const trecho = trechos.find(t => km >= t.kmInicial && km <= t.kmFinal);
  if (!trecho) {
    const trechoProximo = trechos.reduce((prev, curr) => {
      const distPrev = Math.min(Math.abs(km - prev.kmInicial), Math.abs(km - prev.kmFinal));
      const distCurr = Math.min(Math.abs(km - curr.kmInicial), Math.abs(km - curr.kmFinal));
      return distPrev < distCurr ? prev : curr;
    });
    const distInicial = Math.abs(km - trechoProximo.kmInicial);
    const distFinal = Math.abs(km - trechoProximo.kmFinal);
    return distInicial < distFinal ? trechoProximo.coordInicial : trechoProximo.coordFinal;
  }
  const progresso = (km - trecho.kmInicial) / (trecho.kmFinal - trecho.kmInicial);
  const lat = trecho.coordInicial.lat + (trecho.coordFinal.lat - trecho.coordInicial.lat) * progresso;
  const lng = trecho.coordInicial.lng + (trecho.coordFinal.lng - trecho.coordInicial.lng) * progresso;
  return { lat, lng };
}

// ═══════════════════════ 5) Funções de Carregamento de Dados

/**
 * Carrega a planilha `assets/data/MALHA CGR02SAC.xlsx` usando SheetJS e popula o painel inferior esquerdo
 */
async function carregarPlanilhaMalha() {
  try {
    if (typeof XLSX === 'undefined') {
      console.warn('📦 SheetJS (XLSX) não está disponível no ambiente. Verifique se o script foi incluído.');
      const container = document.getElementById('malha-xlsx-table-container');
      if (container) container.innerHTML = '<div style="color:#c00">SheetJS não disponível.</div>';
      return;
    }

    const PATH = 'assets/data/MALHA CGR02SAC.xlsx';
    console.log('📥 Carregando planilha:', PATH);
    const resp = await fetch(PATH);
    if (!resp.ok) {
      console.warn('⚠️ Não foi possível buscar a planilha:', resp.status);
      const container = document.getElementById('malha-xlsx-table-container');
      if (container) container.innerHTML = `<div style="color:#c00">Arquivo não encontrado: ${PATH}</div>`;
      return;
    }
    const ab = await resp.arrayBuffer();
    const workbook = XLSX.read(ab, { type: 'array' });
    
    // Procura pela aba "SAC" (case-insensitive)
    let sacSheetName = null;
    for (const sn of workbook.SheetNames) {
      if (sn.toUpperCase() === 'SAC') {
        sacSheetName = sn;
        break;
      }
    }
    
    // Se não encontrou "SAC", usa a primeira aba
    if (!sacSheetName) {
      console.warn('⚠️ Aba "SAC" não encontrada. Usando primeira aba:', workbook.SheetNames[0]);
      sacSheetName = workbook.SheetNames[0];
    }
    
    const worksheet = workbook.Sheets[sacSheetName];
    console.log(`📄 Lendo aba: ${sacSheetName}`);
    
    // Lê com header: 1 para obter array de arrays (colunas A, B, C, D, ...)
    const json = XLSX.utils.sheet_to_json(worksheet, { defval: '', header: 1 });

    // Converte array de arrays em objetos mapeando colunas A, B, C, D
    const allRows = json
      .filter((row, idx) => {
        // Ignora linhas vazias
        if (!row || row.length === 0) return false;
        // Se primeira linha parece ser cabeçalho, ignora
        if (idx === 0 && row.some(v => String(v).toLowerCase().includes('rodovia') || String(v).toLowerCase().includes('km') || String(v).toLowerCase().includes('inicial'))) return false;
        return row.some(v => String(v).trim());
      })
      .map(row => ({
        Rodovia: String(row[0] || '').trim(),        // Coluna A
        km_inicial: String(row[1] || '').trim(),     // Coluna B
        km_final: String(row[2] || '').trim(),       // Coluna C
        Municipio: String(row[3] || '').trim()       // Coluna D
      }));
    // Detecta rodovia filtrada pelo select
    let rodoviaFiltrada = '';
    const sel = document.getElementById('select-rodovia');
    if (sel && sel.value) {
      rodoviaFiltrada = sel.options[sel.selectedIndex].textContent.trim();
    }

    // Normaliza para comparar
    function norm(s) {
      if (!s && s !== 0) return '';
      try { return String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
      catch (e) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
    }

    let rows = allRows;
    if (rodoviaFiltrada && rodoviaFiltrada !== 'Todas') {
      const rodNorm = norm(rodoviaFiltrada);
      rows = allRows.filter(r => norm(r.Rodovia).includes(rodNorm) || rodNorm.includes(norm(r.Rodovia)));
    }

    const container = document.getElementById('malha-xlsx-table-container');
    if (!container) return;

    if (!rows || !rows.length) {
      container.innerHTML = '<div style="color:#666">Nenhum dado para a rodovia filtrada.</div>';
      return;
    }

    let html = '<table style="width:100%; border-collapse:collapse; font-size:13px;">';
    html += '<thead><tr>' +
      '<th style="text-align:left; padding:6px; border-bottom:1px solid #eee">Rodovia</th>' +
      '<th style="padding:6px; border-bottom:1px solid #eee">Km Inicial</th>' +
      '<th style="padding:6px; border-bottom:1px solid #eee">Km Final</th>' +
      '<th style="padding:6px; border-bottom:1px solid #eee">Município</th>' +
      '</tr></thead><tbody>';

    rows.forEach(r => {
      html += '<tr>' +
        `<td style="padding:6px; border-bottom:1px solid #fafafa">${(r.Rodovia || '')}</td>` +
        `<td style="padding:6px; border-bottom:1px solid #fafafa">${(r.km_inicial || '')}</td>` +
        `<td style="padding:6px; border-bottom:1px solid #fafafa">${(r.km_final || '')}</td>` +
        `<td style="padding:6px; border-bottom:1px solid #fafafa">${(r.Municipio || '')}</td>` +
        '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
    console.log(`✅ MALHA CGR02SAC.xlsx carregada: ${rows.length} linhas (filtradas)`);
  } catch (e) {
    console.error('❌ Erro ao carregar MALHA CGR02SAC.xlsx', e);
    const container = document.getElementById('malha-xlsx-table-container');
    if (container) container.innerHTML = `<div style="color:#c00">Erro lendo planilha: ${e.message || e}</div>`;
  }
}

/**
 * Carrega um CSV e retorna os dados parseados
 */
async function carregarCSV(url, nome) {
  console.log(`📊 Carregando ${nome}...`);
  
  try {
    // Se a URL contém '/edit', converte para formato de exportação
    if (url.includes('/edit')) {
      const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (idMatch) {
        const fileId = idMatch[1];
        url = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`;
      }
    }
    
    // Tenta fazer o fetch dos dados
    let response = await fetch(url);
    
    // Se receber erro, tenta formato alternativo
    if (!response.ok) {
      console.warn(`⚠️ ${nome}: Status ${response.status}, tentando método alternativo...`);
      
      // Tenta extrair ID da URL de diferentes formatos
      const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/) || url.match(/id=([a-zA-Z0-9-_]+)/);
      if (idMatch) {
        const fileId = idMatch[1];
        const urlAlternativa = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`;
        console.log(`🔄 Tentando URL alternativa para ${nome}: ${urlAlternativa}`);
        response = await fetch(urlAlternativa);
      }
    }
    
    // Verifica se houve redirecionamento (planilha não pública)
    if (response.status === 303 || response.url.includes('accounts.google.com')) {
      throw new Error(`Planilha "${nome}" não está pública. Configure permissões para "qualquer pessoa com o link".`);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    
    // Verifica se o conteúdo parece ser HTML (erro de login)
    if (csvText.trim().startsWith('<!DOCTYPE') || csvText.includes('<html')) {
      throw new Error(`Planilha "${nome}" retornou HTML ao invés de CSV. Verifique as permissões públicas.`);
    }
    
    // Verifica se o CSV está vazio ou só tem cabeçalhos
    const linhas = csvText.trim().split('\n');
    if (linhas.length <= 1) {
      console.warn(`⚠️ ${nome}: Planilha parece estar vazia (${linhas.length} linhas)`);
    }
    
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transform: (value) => {
          if (value === undefined || value === null) return '';
          const trimmed = value.toString().trim();
          // Tenta converter números com vírgula para ponto
          if (/^\d+,\d+$/.test(trimmed)) {
            return trimmed.replace(',', '.');
          }
          return trimmed;
        },
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn(`⚠️ Avisos no parsing de ${nome}:`, results.errors);
          }
          
          // Normaliza os nomes das colunas (converte para minúsculas)
          const dados = results.data.map(row => {
            const newRow = {};
            Object.keys(row).forEach(key => {
              newRow[key.toUpperCase()] = row[key];
              newRow[key.toLowerCase()] = row[key];
            });
            return newRow;
          });
          
          console.log(`✅ ${nome} carregado: ${dados.length} registros`);
          resolve(dados);
        },
        error: (error) => {
          console.error(`❌ Erro no parsing de ${nome}:`, error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error(`❌ Erro ao carregar ${nome}:`, error);
    throw error;
  }
}

/**
 * Carrega todos os CSVs e metadados
 */
async function carregarTodosDados() {
  console.log("🚀 Iniciando carregamento de dados...");
  
  try {
    // Carrega metadados primeiro para ter coordenadas disponíveis
    console.log("📍 Carregando metadados das rodovias...");
    await Promise.all([
      carregarMetadadosRodovias(),
      carregarMalhaOficial()
    ]);
    // Carrega o CSV de linhas por trecho
    const [linhas] = await Promise.all([
      carregarCSV(CSV_URLS.linhasPorTrecho, 'Linhas por Trecho')
    ]);
    dados.linhasPorTrecho = linhas;
    // Debug: mostra dados carregados
    console.log("📊 DADOS CARREGADOS:");
    console.log("🛣️ Linhas por Trecho:", dados.linhasPorTrecho);
    // Renderiza os dados no mapa
    renderizarLinhasPorTrecho();
    console.log("🎉 Todos os dados carregados e renderizados com sucesso!");
    mostrarNotificacao("✅ Dados atualizados com sucesso!", "success");
    
    // Filtros removidos: inicialização de filtros descartada
  } catch (error) {
    console.error("💥 Erro ao carregar dados:", error);
    let mensagem = "Erro ao carregar dados.";
    if (error.message.includes('não está pública')) {
      mensagem = "🔒 Planilhas não públicas. Configure permissões no Google Drive.";
    } else if (error.message.includes('Failed to fetch')) {
      mensagem = "🌐 Erro de conexão. Verifique sua internet.";
    } else if (error.message.includes('HTTP 500')) {
      mensagem = "⚠️ Servidor temporariamente indisponível. Tente novamente em alguns segundos.";
    } else if (error.message.includes('HTTP')) {
      mensagem = `📡 Erro no servidor: ${error.message}`;
    }
    mostrarNotificacao(mensagem, "error");
  }
}

// ═══════════════════════ 5) Funções de Renderização

/**
 * Renderiza as linhas por trecho
 */
function renderizarLinhasPorTrecho(dadosFiltrados = null) {
  console.log("🛣️ Renderizando linhas por trecho...");
  const dadosParaRenderizar = dadosFiltrados || dados.linhasPorTrecho;
  console.log("📊 Dados recebidos:", dadosParaRenderizar);
  
  // Atualiza visibilidade/estilo das camadas vetoriais (malha KMZ) com base nos filtros
  try {
    // quando há dados filtrados, determina os nomes das rodovias ativas
    const activeRodovias = new Set();
    if (Array.isArray(dadosFiltrados) && dadosFiltrados.length) {
      dadosFiltrados.forEach(d => {
        const r = (d.RODOVIAS || d.rodovias || d.RODOVIA || d.rodovia || '').toString().trim();
        if (r) {
          // normalização agressiva semelhante à usada para matching
          let nr = r;
          try { nr = String(nr).normalize('NFD').replace(/\p{Diacritic}/gu, ''); } catch(e) { nr = String(nr).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
          nr = nr.toLowerCase().replace(/[^a-z0-9]/g, '');
          activeRodovias.add(nr);
        }
      });
    }
    // aplica estilo: mostra apenas as rodovias ativas, oculta as demais
    Object.keys(rodLayers || {}).forEach(key => {
      try {
        const normKey = (() => { try { return String(key).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, ''); } catch(e) { return String(key).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); } })();
        const layer = rodLayers[key];
        if (!layer || !layer.setStyle) return;
        if (activeRodovias.size === 0) {
          // restaura estilo padrão
          const def = rodLayerDefaults[key] || { color: '#000000ff', weight: 3, opacity: 0.9 };
          try { layer.setStyle(def); } catch(e){}
        } else {
          if (Array.from(activeRodovias).some(ar => normKey.includes(ar) || ar.includes(normKey))) {
            // realça
            try { layer.setStyle({ color: '#ff0000', weight: 4, opacity: 1.0 }); } catch(e){}
            try { if (!mapa.hasLayer(layer)) mapa.addLayer(layer); } catch(e){}
          } else {
            // esconde discretamente
            try { layer.setStyle({ color: '#ffffff', weight: 0.5, opacity: 0.06 }); } catch(e){}
          }
        }
      } catch (e) { console.debug('Erro ao ajustar rodLayers', e); }
    });
  } catch (e) { console.debug('Erro ao aplicar visibilidade KMZ', e); }

  layers.linhas.clearLayers();
  
  dadosParaRenderizar.forEach((linha, index) => {
    try {
      const rodovia = linha.RODOVIAS || linha.rodovias || linha.RODOVIA || linha.rodovia || `Rodovia ${index + 1}`;
      const kmInicial = parseFloat((linha.KM_INICIAL || linha.km_inicial || linha['km_inicial'] || '').toString().replace(',', '.')) || 0;
      const kmFinal = parseFloat((linha.KM_FINAL || linha.km_final || linha['km_final'] || '').toString().replace(',', '.')) || 0;
      const cor = linha.COR || linha.cor || linha.cor_hex || linha.COR_HEX || '#0000FF';
      const espessura = parseInt(linha.ESPESSURA) || parseInt(linha.espessura) || 3;
      
      console.log(`🛣️ Processando linha: ${rodovia}, Km ${kmInicial}-${kmFinal}, Cor: ${cor}, Espessura: ${espessura}`);
      
      // Gera pontos intermediários para máxima precisão (malha oficial / vetorial)
      let pontos = [];

      // Helpers locais: normalização, suavização e densificação
      // Helper local: normaliza strings (remove acentos e lower)
      function normalizeStrLocal(s) {
        if (s === undefined || s === null) return '';
        try { return String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase(); }
        catch (e) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
      }

      // Chaikin smoothing (operates on array of [lat,lng])
      function chaikinSmooth(points, iterations = 1) {
        if (!points || points.length < 3) return points;
        let pts = points.map(p => [p[0], p[1]]);
        for (let it = 0; it < iterations; it++) {
          const out = [];
          out.push(pts[0]); // keep first
          for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i];
            const p1 = pts[i+1];
            const Q = [p0[0] * 0.75 + p1[0] * 0.25, p0[1] * 0.75 + p1[1] * 0.25];
            const R = [p0[0] * 0.25 + p1[0] * 0.75, p0[1] * 0.25 + p1[1] * 0.75];
            out.push(Q);
            out.push(R);
          }
          out.push(pts[pts.length - 1]); // keep last
          pts = out;
        }
        return pts;
      }

      // Densifica uma linha (coords [[lat,lng],...]) usando turf, espaçamento em km
      function densifyWithTurf(coords, spacingKm = 0.02, maxSamples = 2000) {
        try {
          if (typeof turf === 'undefined' || typeof turf.lineString !== 'function') return coords;
          if (!coords || coords.length < 2) return coords;
          const lineCoords = coords.map(c => [c[1], c[0]]); // [lng,lat]
          const line = turf.lineString(lineCoords);
          const length = turf.length(line, { units: 'kilometers' });
          if (!length || length <= 0) return coords;
          const samples = Math.min(Math.ceil(length / spacingKm) + 1, maxSamples);
          const out = [];
          for (let i = 0; i <= samples; i++) {
            const dist = Math.min((i / samples) * length, length);
            const pt = turf.along(line, dist, { units: 'kilometers' });
            if (pt && pt.geometry && pt.geometry.coordinates) {
              out.push([pt.geometry.coordinates[1], pt.geometry.coordinates[0]]);
            }
          }
          return out;
        } catch (e) {
          console.debug('densifyWithTurf erro', e);
          return coords;
        }
      }

      // Tenta encontrar a chave correspondente na indexMalhaOficial de forma tolerante
      let idxRodKey = null;
      if (indexMalhaOficial && Object.keys(indexMalhaOficial).length) {
        const rodKeys = Object.keys(indexMalhaOficial);
        const nRod = normalizeStrLocal(rodovia);
        // procura igualdade exata normalizada
        idxRodKey = rodKeys.find(k => normalizeStrLocal(k) === nRod);
        // busca por inclusão da string (rodovia pequena dentro da chave maior)
        if (!idxRodKey) idxRodKey = rodKeys.find(k => normalizeStrLocal(k).includes(nRod));
        // busca por inclusão inversa (chave curta dentro do nome fornecido)
        if (!idxRodKey) idxRodKey = rodKeys.find(k => nRod.includes(normalizeStrLocal(k)));
      }

      if (idxRodKey && indexMalhaOficial[idxRodKey]) {
        // Amostragem adaptativa baseada em desvio do ponto médio (fidelidade às curvas)
        // Parâmetros
        const MAX_STEP_KM = 0.2; // início: 200m
        const MIN_STEP_KM = 0.01; // mínimo: 10m
        const TOLERANCE_METERS = 8; // se meio real desvia mais que isso do linear, subdivide
        const MAX_POINTS = 3000;

        // Haversine distance (m)
        function haversine(a, b) {
          const R = 6371000;
          const toRad = v => v * Math.PI / 180;
          const dLat = toRad(b[0] - a[0]);
          const dLon = toRad(b[1] - a[1]);
          const lat1 = toRad(a[0]);
          const lat2 = toRad(b[0]);
          const sinDlat = Math.sin(dLat/2), sinDlon = Math.sin(dLon/2);
          const aa = sinDlat*sinDlat + Math.cos(lat1)*Math.cos(lat2)*sinDlon*sinDlon;
          const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
          return R * c;
        }

        // Cache de coordenadas por km para evitar fetch repetido
        const coordCache = new Map();
        function getCoordCached(km) {
          const key = Number(km).toFixed(3);
          if (coordCache.has(key)) return coordCache.get(key);
          try {
            const c = obterCoordenadaReal(rodovia, km);
            coordCache.set(key, c);
            return c;
          } catch (e) { coordCache.set(key, null); return null; }
        }

        // Inicializa segmentos com passos iniciais
        const segments = [];
        for (let s = kmInicial; s < kmFinal; s = Math.round((s + MAX_STEP_KM) * 1000) / 1000) {
          const e = Math.min(kmFinal, Math.round((s + MAX_STEP_KM) * 1000) / 1000);
          segments.push([s, e]);
          if (segments.length > MAX_POINTS) break;
        }
        if (segments.length === 0) segments.push([kmInicial, kmFinal]);

        const finalSegments = [];
        const stack = segments.slice();
        while (stack.length && coordCache.size < MAX_POINTS) {
          const seg = stack.shift();
          const a = seg[0], b = seg[1];
          const mid = Math.round(((a + b) / 2) * 1000) / 1000;
          const A = getCoordCached(a);
          const B = getCoordCached(b);
          const M = getCoordCached(mid);
          if (!A || !B || !M) {
            // se faltar coordenada, aceita extremos para não travar
            finalSegments.push([a, b]);
            continue;
          }
          // ponto médio linear entre A e B
          const interpMid = [(A.lat + B.lat) / 2, (A.lng + B.lng) / 2];
          const dev = haversine(interpMid, [M.lat, M.lng]);
          const step = b - a;
          if (dev > TOLERANCE_METERS && (step / 2) >= MIN_STEP_KM) {
            // subdivide
            stack.unshift([mid, b]);
            stack.unshift([a, mid]);
          } else {
            finalSegments.push([a, b]);
          }
          // safety cap
          if (finalSegments.length + stack.length > MAX_POINTS) break;
        }

        // Construir pontos ordenados a partir dos segmentos finais
        finalSegments.sort((x, y) => x[0] - y[0]);
        const pts = [];
        for (let i = 0; i < finalSegments.length; i++) {
          const s = finalSegments[i][0];
          const c = getCoordCached(s);
          if (c && c.lat !== undefined && c.lng !== undefined) pts.push([c.lat, c.lng]);
        }
        // adiciona ponto final
        const lastC = getCoordCached(kmFinal);
        if (lastC && lastC.lat !== undefined && lastC.lng !== undefined) pts.push([lastC.lat, lastC.lng]);

        // Remove duplicatas muito próximas
        const filtered = [];
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          const prev = filtered[filtered.length - 1];
          if (!prev) { filtered.push(p); continue; }
          if (haversine(prev, p) > 0.5) filtered.push(p); // 0.5m threshold
        }
        pontos = filtered;

        // Suaviza levemente
        pontos = chaikinSmooth(pontos, 1);
      } else {
        // Se não encontrou a chave na malha oficial, log para depuração
        if (!idxRodKey) console.debug(`renderizar: não encontrou rodovia na malha oficial para '${rodovia}' (chaves disponíveis: ${Object.keys(indexMalhaOficial || {}).slice(0,10).join(', ')}...)`);
      }
      // Se não encontrou pontos na malha oficial, tenta usar coordenadas reais e a malha vetorial (KMZ)
      if (pontos.length < 2) {
        const coordInicial = obterCoordenadaReal(rodovia, kmInicial);
        const coordFinal = obterCoordenadaReal(rodovia, kmFinal);

        // Função auxiliar: tenta extrair trecho da camada vetorial (rodLayers)
        function tryExtractFromRodLayer(coordIni, coordFim) {
          if (!coordIni || !coordFim) return null;
          if (!rodLayers || !Object.keys(rodLayers).length) return null;
          const rodKeys = Object.keys(rodLayers);

          // Normalização mais agressiva pra matching: remove acentos, espaços e caracteres não alfanuméricos
          function aggressiveNorm(s) {
            if (!s) return '';
            try { s = String(s).normalize('NFD').replace(/\p{Diacritic}/gu, ''); }
            catch (e) { s = String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
            return s.toLowerCase().replace(/[^a-z0-9]/g, '');
          }

          const nRod = aggressiveNorm(rodovia);
          let matchKey = rodKeys.find(k => aggressiveNorm(k) === nRod) ||
                         rodKeys.find(k => aggressiveNorm(k).includes(nRod)) ||
                         rodKeys.find(k => nRod.includes(aggressiveNorm(k)));
          if (!matchKey) {
            // tenta match por tokens (números ou prefixos)
            const tokens = nRod.match(/\d+/g) || [];
            if (tokens.length) {
              matchKey = rodKeys.find(k => tokens.every(t => aggressiveNorm(k).includes(t)));
            }
          }
          if (!matchKey) {
            console.debug(`renderizar: não encontrou layer correspondente para '${rodovia}'`);
            return null;
          }
          const layer = rodLayers[matchKey];
          if (!layer) return null;

          // Obtém GeoJSON da camada
          let geo = null;
          try {
            if (typeof layer.toGeoJSON === 'function') geo = layer.toGeoJSON();
            else if (layer && layer.getLayers && layer.getLayers()[0] && typeof layer.getLayers()[0].toGeoJSON === 'function') geo = layer.getLayers()[0].toGeoJSON();
          } catch (e) {
            console.debug('renderizar: falha ao obter geojson da camada', e);
          }
          if (!geo || !geo.features) return null;

          // Seleciona a feature com a linha mais longa
          let bestFeature = null;
          let bestLen = 0;
          geo.features.forEach(f => {
            if (!f.geometry) return;
            let len = 0;
            if (f.geometry.type === 'LineString') len = f.geometry.coordinates.length;
            else if (f.geometry.type === 'MultiLineString') len = f.geometry.coordinates.flat().length;
            if (len > bestLen) { bestLen = len; bestFeature = f; }
          });
          if (!bestFeature) return null;

          // Se Turf está disponível, usa lineSlice para recortar exatamente entre projeções das coordenadas
          if (typeof turf !== 'undefined' && typeof turf.lineSlice === 'function') {
            try {
              const lineCoords = (bestFeature.geometry.type === 'LineString') ? bestFeature.geometry.coordinates : bestFeature.geometry.coordinates.flat();
              const line = turf.lineString(lineCoords);
              const startPt = turf.point([coordIni.lng, coordIni.lat]);
              const endPt = turf.point([coordFim.lng, coordFim.lat]);
              const sliced = turf.lineSlice(startPt, endPt, line);
              if (sliced && sliced.geometry && sliced.geometry.coordinates && sliced.geometry.coordinates.length) {
                const coords = sliced.geometry.coordinates.map(c => [c[1], c[0]]);
                if (coords.length >= 2) {
                  console.debug(`renderizar: trecho recortado com turf para '${rodovia}' usando layer '${matchKey}' (pontos: ${coords.length})`);
                  return coords;
                }
              }
            } catch (e) {
              console.debug('renderizar: erro ao usar turf.lineSlice', e);
            }
          }

          // Fallback sem Turf ou se resultado insuficiente: usa o vértice mais próximo, expandindo a janela para captar curvas
          let bestCoords = null;
          if (bestFeature.geometry.type === 'LineString') bestCoords = bestFeature.geometry.coordinates;
          else if (bestFeature.geometry.type === 'MultiLineString') bestCoords = bestFeature.geometry.coordinates.flat();
          if (!bestCoords || !bestCoords.length) return null;
          const latlngs = bestCoords.map(c => ({ lat: c[1], lng: c[0] }));
          function nearestIndex(arr, pt) {
            let idx = 0; let min = Infinity;
            for (let i = 0; i < arr.length; i++) {
              const dLat = arr[i].lat - pt.lat;
              const dLng = arr[i].lng - pt.lng;
              const dist = dLat * dLat + dLng * dLng;
              if (dist < min) { min = dist; idx = i; }
            }
            return idx;
          }
          const iStart = nearestIndex(latlngs, coordIni);
          const iEnd = nearestIndex(latlngs, coordFim);
          if (iStart === undefined || iEnd === undefined) return null;
          let a = Math.min(iStart, iEnd), b = Math.max(iStart, iEnd);
          // Expand window até captar curvas (limite de 10 vértices para cada lado)
          const expand = 6;
          a = Math.max(0, a - expand);
          b = Math.min(latlngs.length - 1, b + expand);
          const slice = latlngs.slice(a, b + 1).map(p => [p.lat, p.lng]);
          console.debug(`renderizar: trecho extraído por vértices para '${rodovia}' layer '${matchKey}' (índices ${a}-${b}, pontos ${slice.length})`);
          return slice;
        }

        // Primeiro tenta extrair da malha vetorial usando as coordenadas obtidas
        const trechoFromLayer = tryExtractFromRodLayer(coordInicial, coordFinal);
        if (trechoFromLayer && trechoFromLayer.length >= 2) {
          // Prioriza a malha vetorial (mais precisa). Densifica e suaviza para qualidade máxima.
          pontos = trechoFromLayer;
          // densify via turf para 20m spacing e suaviza com Chaikin
          try {
            const dens = densifyWithTurf(pontos, 0.02, 3000); // 20m
            pontos = chaikinSmooth(dens, 2);
          } catch (e) { console.debug('Erro ao densificar/suavizar trechoFromLayer', e); }
        } else if (coordInicial && coordFinal) {
          // Se não conseguiu, usa as coordenadas diretas (inicio->fim) como fallback
          pontos = [ [coordInicial.lat, coordInicial.lng], [coordFinal.lat, coordFinal.lng] ];
        } else {
          // Fallback visual
          const latBase = -23.5 - (index * 0.15);
          const lngBase = -46.6 + (index * 0.2);
          pontos = [ [latBase, lngBase], [latBase - 0.05, lngBase + 0.1] ];
          console.warn(`renderizar: fallback geográfico para '${rodovia}' Km ${kmInicial}-${kmFinal}`);
        }
      }
      const linha_geom = L.polyline(pontos, {
        color: cor,
        weight: espessura,
        pane: 'rodoviasPane',
        opacity: 0.8
      });
      // Popup detalhado
      linha_geom.bindPopup(`
        <strong>🛣️ ${rodovia}</strong><br>
        📍 Km ${kmInicial.toFixed(3)} - ${kmFinal.toFixed(3)}<br>
        🎨 Cor: ${cor}<br>
        📏 Espessura: ${espessura}px<br>
        <small>📄 Dados da planilha: Linhas por Trecho</small>
      `);
      layers.linhas.addLayer(linha_geom);
      
    } catch (error) {
      console.error(`Erro ao renderizar linha ${index}:`, error, linha);
    }
  });
  
  console.log(`✅ ${dados.linhasPorTrecho.length} linhas por trecho renderizadas`);
  // Auto-zoom quando foi passado um conjunto filtrado (ex.: seleção de rodovia)
  try {
    const bounds = layers.linhas.getBounds && layers.linhas.getBounds();
    if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
      // Se a função recebeu dadosFiltrados explicitamente, assumimos que é uma ação de filtro
      if (dadosFiltrados && Array.isArray(dadosFiltrados) && dadosFiltrados.length) {
        try { mapa.fitBounds(bounds, { padding: [60, 60] }); } catch (e) { console.debug('fitBounds falhou', e); }
      }
    }
  } catch (e) { /* silencioso */ }
}

// Funções de renderização removidas

// ═══════════════════════ 6) Funções Utilitárias

/**
 * Mostra notificação para o usuário
 */
function mostrarNotificacao(mensagem, tipo = 'info') {
  const div = document.createElement('div');
  div.className = `notificacao notificacao-${tipo}`;
  div.innerHTML = `
    <span>${mensagem}</span>
    <button onclick="this.parentElement.remove()">×</button>
  `;
  
  // Adiciona estilos se não existirem
  if (!document.getElementById('notificacao-styles')) {
    const style = document.createElement('style');
    style.id = 'notificacao-styles';
    style.textContent = `
      .notificacao {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        padding: 12px 16px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
      }
      .notificacao-info { background: #2196F3; }
      .notificacao-error { background: #f44336; }
      .notificacao-success { background: #4CAF50; }
      .notificacao button {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(div);
  
  // Remove automaticamente após 5 segundos
  setTimeout(() => {
    if (div.parentElement) {
      div.remove();
    }
  }, 5000);
}

/* Controles do mapa removidos */

// ═══════════════════════ 6) Carregamento de Shapefiles

// Helper para adicionar rótulos
const addLabel = (latlng, txt, cls) =>
  L.marker(latlng, {
    pane: "overlayPane",
    icon: L.divIcon({ className: "", html: `<div class='${cls}'>${txt}</div>`, iconSize: null }),
    interactive: false,
  }).addTo(mapa);

/**
 * Carrega shapefiles das RCs
 */
async function carregarRC() {
  console.log("🗺️ Carregando shapefiles das RCs...");
  
  // tenta carregar um manifest gerado (assets/data/shapefiles.json) contendo apenas os ZIPs desejados
  let rcList = [];
  try {
    const manifestResp = await fetch('assets/data/shapefiles.json');
    if (manifestResp.ok) {
      const manifest = await manifestResp.json();
      if (Array.isArray(manifest) && manifest.length) {
        rcList = manifest;
        console.log('ℹ️ Manifest de shapefiles carregado:', rcList);
      }
    }
  } catch (e) {
    console.debug('Não foi possível carregar manifest de shapefiles:', e);
  }
  // fallback para lista antiga caso não exista manifest
  if (!rcList || rcList.length === 0) {
    rcList = [
      "assets/data/RC_2.1.zip",
      "assets/data/RC_2.2.zip",
      "assets/data/RC_2.4.zip",
      "assets/data/RC_2.5.zip",
      "assets/data/RC_2.6_2.8.zip",
      "assets/data/RC_2.7.zip",
      "assets/data/Lote Azul CGR02.zip",
      "assets/data/Lote Rosa CGR02.zip",
      "assets/data/Lote Verde CGR02.zip",
    ];
    console.log('ℹ️ Usando lista de shapefiles interna (fallback)');
  }

  for (const p of rcList) {
    try {
        if (typeof shp !== 'undefined') {
        const geo = await shp(p);
        // Extrai um nome legível do caminho do arquivo (basename sem extensão)
        const raw = p.split('/').pop().replace(/\.[^/.]+$/, '');
        let name = raw;
        // preserva nomenclaturas antigas do tipo RC_2.1 quando presentes
        const rcMatch = raw.match(/RC_[\d._]+/i);
        if (rcMatch) name = rcMatch[0].replace(/_/g, ' ');
        // substitui underscores por espaços e faz um trim
        name = name.replace(/_/g, ' ').trim();
        // aplica estilo especial para o Lote Azul se detectado
        const lowerName = (name || '').toLowerCase();
        let styleOpts = { color: "#000", weight: 2.5, fill: false };
        // estilos específicos por lote
        if (lowerName.includes('lote azul')) {
          styleOpts = {
            color: '#000000ff',    // borda
            weight: 1.5,
            fill: true,
            fillColor: '#ADD8E6', // azul claro
            fillOpacity: 0.25
          };
        } else if (lowerName.includes('lote verde')) {
          styleOpts = {
            color: '#000000ff',
            weight: 1.5,
            fill: true,
            fillColor: '#90EE90', // verde claro
            fillOpacity: 0.25
          };
        } else if (lowerName.includes('lote rosa') || lowerName.includes('lote rosa cgr02') || lowerName.includes('lote rosa cgr')) {
          styleOpts = {
            color: '#000000ff',
            weight: 1.5,
            fill: true,
            fillColor: '#FD99A2', // rosa
            fillOpacity: 0.25
          };
        }
        rcLayers[name] = L.geoJSON(geo, {
          pane: "shapefilePane",
          style: styleOpts,
        }).addTo(mapa);
        // reaplica estilo e traz para frente para garantir visibilidade (aplica para lotes específicos)
        try {
          if ((lowerName.includes('lote azul') || lowerName.includes('lote verde') || lowerName.includes('lote rosa')) && rcLayers[name] && typeof rcLayers[name].setStyle === 'function') {
            rcLayers[name].setStyle(styleOpts);
            if (typeof rcLayers[name].bringToFront === 'function') rcLayers[name].bringToFront();
          }
        } catch (e) { console.debug('Erro ao aplicar estilo de lote específico', e); }
        // label removido conforme solicitado (não adicionar texto sobre o shapefile)
        console.log(`✅ RC carregado: ${name}`);
      }
    } catch (err) {
      console.warn(`❌ Erro ao carregar RC ${p}:`, err);
    }
  }

  carregarMalha();
}

/**
 * Carrega malha rodoviária DR.02
 */
async function carregarMalha() {
  console.log("🛣️ Carregando malha rodoviária...");
  
  const MALHA_PATH = "assets/data/malha_dr02.kmz";
  try {
    if (typeof JSZip !== 'undefined' && typeof toGeoJSON !== 'undefined') {
      const resp = await fetch(MALHA_PATH);
      if (!resp.ok) throw new Error(`404 – não achei ${MALHA_PATH}`);

      const zip = await JSZip.loadAsync(await resp.arrayBuffer());
      const kmlFile = Object.keys(zip.files).find((f) => f.toLowerCase().endsWith(".kml"));
      if (!kmlFile) throw new Error(".kml ausente dentro do KMZ");

      const xml = await zip.file(kmlFile).async("string");
      const geo = toGeoJSON.kml(new DOMParser().parseFromString(xml, "text/xml"));
      
      geo.features
        .filter((f) => f.geometry && ["LineString", "MultiLineString"].includes(f.geometry.type))
        .forEach((feat) => {
          const nomeCompleto = (feat.properties?.name || "Rodovia").replaceAll("_", " ").trim();
          // Extrai sempre o nome completo para SPA (ex: SPA 294/250)
          let nome = nomeCompleto;
          if (/SPA/i.test(nomeCompleto)) {
            // Se houver barra, pega tudo após SPA
            const spaMatch = nomeCompleto.match(/SPA ?\d+\/\d+/);
            if (spaMatch) {
              nome = spaMatch[0];
            } else {
              // Se não houver barra, pega SPA + número
              const spaSimple = nomeCompleto.match(/SPA ?\d+/);
              if (spaSimple) nome = spaSimple[0];
            }
          } else {
            // Para SP, pega SP + número
            const spMatch = nomeCompleto.match(/SP ?\d+/);
            if (spMatch) nome = spMatch[0];
          }
          // Adiciona o label e armazena referência
            let createdLayer = null;
            if (typeof turf !== 'undefined') {
              createdLayer = L.geoJSON(turf.simplify(feat, { tolerance: 0.00005 }), {
                pane: "rodoviasPane",
                style: { color: "#1A73E8", weight: 3, opacity: 1 },
              }).addTo(mapa);
            } else {
              createdLayer = L.geoJSON(feat, {
                pane: "rodoviasPane",
                style: { color: "#1A73E8", weight: 3, opacity: 1 },
              }).addTo(mapa);
            }
            rodLayers[nomeCompleto] = createdLayer;
            // guarda o estilo padrão para esta camada para podermos restaurar depois
            rodLayerDefaults[nomeCompleto] = { color: "#1A73E8", weight: 3, opacity: 1 };
            
            // Adiciona handler de clique para exibir metadados
            createdLayer.on('click', function(e) {
              console.log('🖱️ Clique em rodovia:', nomeCompleto);
              // Encontra o nome original em metadadosRodovias
              if (metadadosRodovias) {
                const rodoviaChave = Object.keys(metadadosRodovias).find(r => 
                  (r || '').toLowerCase().replace(/[^a-z0-9]/g, '') === nomeCompleto.toLowerCase().replace(/[^a-z0-9]/g, '')
                );
                if (rodoviaChave) {
                  exibirMetadadosRodovia(rodoviaChave);
                }
              }
            });
            
            // indexa metadados para matching por filtros (normaliza o nome)
            try {
              const norm = (s) => {
                if (!s && s !== 0) return '';
                try { return String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
                catch (e) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
              };
              const key = norm(nomeCompleto);
              rodLayerIndex[key] = rodLayerIndex[key] || [];
              // store layer reference and properties
              rodLayerIndex[key].push({
                key: nomeCompleto,
                layer: createdLayer,
                properties: feat.properties || {}
              });
            } catch (e) { console.debug('Erro indexando rodLayer', e); }
        });
        
      console.log(`✅ Malha rodoviária carregada com ${Object.keys(rodLayers).length} rodovias`);
      // Após carregar a malha, inicializa o filtro de rodovias no UI (se ainda não feito)
      try {
        if (typeof createRodoviaFilterUI === 'function') createRodoviaFilterUI();
      } catch (e) { console.debug('Erro ao inicializar UI filtro rodovia', e); }
    }
  } catch (err) {
    console.warn("❌ Erro ao carregar malha rodoviária:", err);
  }
}

/**
 * Exibe metadados da rodovia no card
 */
function exibirMetadadosRodovia(rodoviaChave) {
  try {
    console.log('📋 exibirMetadadosRodovia chamado com:', rodoviaChave);
    
    if (!rodoviaChave || !metadadosRodovias) {
      console.warn('❌ rodoviaChave ou metadadosRodovias vazio');
      return;
    }
    
    // Busca diretamente pela chave (que já vem do metadadosRodovias)
    if (!metadadosRodovias[rodoviaChave] || metadadosRodovias[rodoviaChave].length === 0) {
      console.warn(`⚠️ Metadados não encontrados para ${rodoviaChave}`);
      console.log('Chaves disponíveis:', Object.keys(metadadosRodovias || {}).slice(0, 10));
      return;
    }
    
    const trecho = metadadosRodovias[rodoviaChave][0]; // pega o primeiro trecho
    console.log('📍 Trecho encontrado:', trecho);
    
    const card = document.getElementById('rodovia-metadata-card');
    console.log('🎨 Card element encontrado?', !!card);
    if (!card) {
      console.error('❌ Card não encontrado no DOM');
      return;
    }
    
    // Popula o card com dados
    const cardNome = document.getElementById('card-rodovia-nome');
    const cardKmIni = document.getElementById('card-km-inicial');
    const cardLatLngIni = document.getElementById('card-lat-long-inicial');
    const cardKmFim = document.getElementById('card-km-final');
    const cardLatLngFim = document.getElementById('card-lat-long-final');
    
    console.log('🔧 Elementos do card encontrados?', {
      nome: !!cardNome,
      kmIni: !!cardKmIni,
      latLngIni: !!cardLatLngIni,
      kmFim: !!cardKmFim,
      latLngFim: !!cardLatLngFim
    });
    
    // Formata os dados
    if (cardNome) cardNome.textContent = rodoviaChave;
    if (cardKmIni) cardKmIni.textContent = trecho.kmInicial.toFixed(3) + ' km';
    if (cardKmFim) cardKmFim.textContent = trecho.kmFinal.toFixed(3) + ' km';
    
    // Coordenadas com quebra de linha para melhor leitura
    const latIniFormatado = trecho.coordInicial.lat.toFixed(6);
    const lngIniFormatado = trecho.coordInicial.lng.toFixed(6);
    const latFimFormatado = trecho.coordFinal.lat.toFixed(6);
    const lngFimFormatado = trecho.coordFinal.lng.toFixed(6);
    
    if (cardLatLngIni) cardLatLngIni.innerHTML = `${latIniFormatado}<br>${lngIniFormatado}`;
    if (cardLatLngFim) cardLatLngFim.innerHTML = `${latFimFormatado}<br>${lngFimFormatado}`;
    
    // Mostra o card
    card.style.display = 'block';
    console.log(`✅ Card de metadados exibido para ${rodoviaChave}`);
  } catch (e) {
    console.error('❌ Erro ao exibir metadados rodovia:', e);
  }
}

// Cria UI de filtro de rodovia (popula select com nomes da malha KMZ)
function createRodoviaFilterUI() {
  try {
    if (!document || !document.body) return;
    if (window.__rodFilterInitialized) return; // evita múltiplas criações
    const sel = document.getElementById('select-rodovia');
    const btnClear = document.getElementById('btn-rod-clear');
    if (!sel) return;

    // Normaliza função (mesma usada no resto do script)
    const norm = (s) => {
      if (!s && s !== 0) return '';
      try { return String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
      catch (e) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
    };

    // Gera lista de opções a partir do rodLayerIndex (usa nome original armazenado em .key)
    const seen = new Set();
    const options = [];
    Object.keys(rodLayerIndex || {}).forEach(nkey => {
      const arr = rodLayerIndex[nkey] || [];
      if (!Array.isArray(arr) || !arr.length) return;
      // usa o primeiro registro como label
      const label = arr[0].key || arr[0].key || (arr[0].properties && (arr[0].properties.name || arr[0].properties.NOME)) || null;
      const display = label || Object.values(arr)[0] || nkey;
      const value = nkey;
      if (!seen.has(value)) { seen.add(value); options.push({label: display, value}); }
    });
    // Ordena alfabeticamente pelo label
    options.sort((a,b) => String(a.label).localeCompare(String(b.label)));

    // Limpa e popula
    sel.innerHTML = '';
    const optAll = document.createElement('option'); optAll.value = ''; optAll.textContent = 'Todas'; sel.appendChild(optAll);
    options.forEach(o => {
      const el = document.createElement('option'); el.value = o.value; el.textContent = o.label; sel.appendChild(el);
    });

    // Handler de seleção: mostra apenas a rodovia selecionada
    sel.addEventListener('change', () => {
      const selected = sel.value || '';
      // se vazio -> restaura tudo e oculta card
      if (!selected) {
        Object.keys(rodLayers || {}).forEach(k => {
          try { const layer = rodLayers[k]; const def = rodLayerDefaults[k] || { color: '#555', weight: 3, opacity: 0.9 }; if (layer && layer.setStyle) layer.setStyle(def); if (layer && !mapa.hasLayer(layer)) mapa.addLayer(layer); } catch(e){}
        });
        const card = document.getElementById('rodovia-metadata-card');
        if (card) card.style.display = 'none';
        mostrarNotificacao('🔄 Mostrando todas as rodovias', 'success');
        // Atualiza painel XLSX para mostrar todas as rodovias
        try { carregarPlanilhaMalha(); } catch(e){}
        return;
      }

      let targetLayer = null;
      let targetRodoviaKey = null;
      let targetRodoviaOriginal = null; // armazena o nome original da rodovia em metadadosRodovias
      // percorre rodLayers e aplica estilo de destaque somente na(s) que bater(em) com selected
      Object.keys(rodLayers || {}).forEach(k => {
        try {
          const layer = rodLayers[k];
          const kNorm = norm(k);
          if (!layer || !layer.setStyle) return;
          if (kNorm === selected || kNorm.includes(selected) || selected.includes(kNorm)) {
            targetLayer = layer;
            targetRodoviaKey = k; // armazena o nome original da rodovia
            
            // Tenta encontrar o nome correspondente em metadadosRodovias
            if (!targetRodoviaOriginal && metadadosRodovias) {
              targetRodoviaOriginal = Object.keys(metadadosRodovias).find(r => 
                (r || '').toLowerCase().replace(/[^a-z0-9]/g, '') === kNorm
              );
              console.log(`🔍 Encontrado nome em metadadosRodovias: "${targetRodoviaOriginal}" para layer "${k}"`);
            }
            
            layer.setStyle({ color: '#ff5722', weight: 4, opacity: 1.0 });
            if (!mapa.hasLayer(layer)) mapa.addLayer(layer);
            // traz para frente se suportado
            if (typeof layer.bringToFront === 'function') try { layer.bringToFront(); } catch (e) {}
          } else {
            // esconde discretamente
            layer.setStyle({ color: '#ffffff', weight: 0.5, opacity: 0.06 });
          }
        } catch (e) { console.debug('Erro ao aplicar visibilidade por rodovia', e); }
      });

      if (targetLayer) {
        try {
          const bounds = (typeof targetLayer.getBounds === 'function') ? targetLayer.getBounds() : null;
          if (bounds && bounds.isValid && bounds.isValid()) mapa.fitBounds(bounds, { padding: [40,40] });
        } catch (e) { console.debug('fitBounds falhou no filtro rodovia', e); }
        // Card com metadados agora aparece ao clicar na rodovia no mapa, não ao selecionar no dropdown
      }
      // Atualiza painel XLSX para mostrar apenas dados da rodovia filtrada
      try { carregarPlanilhaMalha(); } catch(e){}
    });

    if (btnClear) btnClear.addEventListener('click', () => { sel.value = ''; sel.dispatchEvent(new Event('change')); });

    window.__rodFilterInitialized = true;
    console.log('✅ UI filtro rodovia (KMZ) inicializado');
  } catch (e) { console.debug('createRodoviaFilterUI erro', e); }
}

// ═══════════════════════ 7) Inicialização

/**
 * Inicializa o sistema quando o DOM estiver pronto
 */
function inicializar() {
  console.log("🚀 Inicializando sistema DR.02...");
  
  // Adiciona controles
  // Controles removidos
  
  // Carrega dados iniciais
  carregarTodosDados();
  
  // Carrega shapefiles (RCs e malha rodoviária)
  setTimeout(() => {
    carregarRC();
    carregarMalha(); // Adiciona carregamento da malha rodoviária
  }, 1000);

  // Carrega a planilha MALHA CGR02SAC.xlsx e popula o painel inferior esquerdo
  try { carregarPlanilhaMalha(); } catch(e){ console.debug('Erro ao iniciar carregamento da planilha MALHA', e); }
  
  // Mostra notificação de boas-vindas
  mostrarNotificacao("🗺️ Sistema DR.02 carregado! Dados colaborativos atualizados.", "success");
}

// Aguarda todas as dependências estarem carregadas
if (typeof Papa !== 'undefined' && typeof L !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
} else {
  console.log("⏳ Aguardando dependências carregar...");
  setTimeout(inicializar, 1000);
}

// ═══════════════════════ 8) Exporta funções para uso global
window.carregarTodosDados = carregarTodosDados;
window.mostrarNotificacao = mostrarNotificacao;

console.log("✅ Script DR.02 Sistema Colaborativo inicializado!");
