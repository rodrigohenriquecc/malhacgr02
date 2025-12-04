/* global L, JSZip, shp, turf, Papa, toGeoJSON */

console.log("script.js carregado (versão com múltiplas fontes)");

// ═══════════════════════ 1) Mapa
const mapa = L.map("map").setView([-23.8, -48.5], 7);
window.mapa = mapa;
["shapefilePane", "rodoviasPane", "overlayPane"].forEach((p, i) => {
  mapa.createPane(p).style.zIndex = 400 + i * 50;
  if (i < 2) mapa.getPane(p).style.pointerEvents = "none";
});
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap",
}).addTo(mapa);

// helper ➜ adiciona rótulo simples
const addLabel = (latlng, txt, cls) =>
  L.marker(latlng, {
    pane: "overlayPane",
    icon: L.divIcon({ className: "", html: `<div class='${cls}'>${txt}</div>`, iconSize: null }),
    interactive: false,
  }).addTo(mapa);

// ═══════════════════════ 2) Variáveis globais
const metaRod = {},
  rcLayers = {},
  rodLayers = {};
const pontosLayer = L.layerGroup([], { pane: "overlayPane" }).addTo(mapa);
const linhasTrechoLayer = L.layerGroup([], { pane: "overlayPane" }).addTo(mapa);
let heatLayer = null;
// Referência global para os labels das rodovias
let rodLabels = [];

// ═══════════════════════ 3) URLs das planilhas (múltiplos caminhos: GitHub → local → compartilhada → Google Sheets)

// URLs do GitHub (RAW) - SUBSTITUA "SEU_USUARIO" e "SEU_REPOSITORIO" pelos valores corretos
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/rodrigohenriquecc/dr02-map-site/main/DadosSite/";
const SHEETS_GITHUB = {
  meta: GITHUB_RAW_BASE + "meta.csv",
  points: GITHUB_RAW_BASE + "pontos_interesse.csv", 
  heat: GITHUB_RAW_BASE + "mapa_calor.csv",
  linhasTrecho: GITHUB_RAW_BASE + "linhas_trecho.csv",
};

const PATHS_LOCAIS = [
  // Computador 1 - Substitua "USUARIO1" pelo nome do usuário real
  "file:///C:/Users/Rodrigo Henrique/Desktop/DadosSite/",
  // Computador 2 - Substitua "USUARIO2" pelo nome do usuário real  
  "file:///C:/Users/USUARIO2/Desktop/DadosSite/",
  // Computador 3 - Substitua "USUARIO3" pelo nome do usuário real
  "file:///C:/Users/USUARIO3/Desktop/DadosSite/",
  // Caminho alternativo na área de trabalho pública
  "file:///C:/Users/Public/Desktop/DadosSite/",
  // Caminho relativo (se a pasta DadosSite estiver junto com o site)
  "./DadosSite/"
];

const SHEETS_LOCAIS = {
  meta: "meta.csv",
  points: "pontos_interesse.csv", 
  heat: "mapa_calor.csv",
  linhasTrecho: "linhas_trecho.csv",
};

const SHEETS_COMPARTILHADA = {
  meta: "https://der59.ultra.com.vc/s/A9F6PG86w6f8fAk/download/meta.csv",
  points: "https://der59.ultra.com.vc/s/A9F6PG86w6f8fAk/download/pontos_interesse.csv",
  heat: "https://der59.ultra.com.vc/s/A9F6PG86w6f8fAk/download/mapa_calor.csv",
  linhasTrecho: "https://der59.ultra.com.vc/s/A9F6PG86w6f8fAk/download/linhas_trecho.csv",
};

const SHEETS_FALLBACK = {
  meta: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTstBNmwEiRbJOsozLwlHibWWf8qbiKZV_VAIv2tRyizMOShkPtPWOPozbSSkPZMTBfdXOsWVmK7mzo/pub?output=csv",
  points: "https://docs.google.com/spreadsheets/d/1eBgwX744ZF4gqGz5AjvPtEre1WBdfR9h/export?format=csv",
  heat: "https://docs.google.com/spreadsheets/d/1W61josvM1UanGOSUurj1qSZTvpL4ovzf/export?format=csv",
  linhasTrecho: "https://docs.google.com/spreadsheets/d/1eBgwX744ZF4gqGz5AjvPtEre1WBdfR9h/export?format=csv",
};

// Variável global para controlar a fonte atual
let SHEETS = {};
let fonteAtual = "local"; // "local", "compartilhada", ou "fallback"

// Função para atualizar indicador de fonte
function atualizarIndicadorFonte(tipo, caminho = "") {
  const indicador = document.getElementById('indicadorFonte');
  const fonteAtualEl = document.getElementById('fonteAtual');
  if (fonteAtualEl) {
    switch (tipo) {
      case "github":
        fonteAtualEl.innerHTML = 'Fonte: <strong style="color: #1976d2;">📂 GitHub Repository</strong>';
        break;
      case "local":
        fonteAtualEl.innerHTML = `Fonte: <strong style="color: #4caf50;">Pasta Local</strong><br><small style="color: #666;">${caminho}</small>`;
        break;
      case "compartilhada":
        fonteAtualEl.innerHTML = 'Fonte: <a href="https://der59.ultra.com.vc/s/A9F6PG86w6f8fAk" target="_blank" style="color: #1976d2;">pasta compartilhada</a>';
        break;
      case "fallback":
        fonteAtualEl.innerHTML = 'Fonte: <a href="https://docs.google.com/spreadsheets" target="_blank" style="color: #1976d2;">Google Sheets</a>';
        break;
      default:
        fonteAtualEl.innerHTML = 'Carregando...';
    }
  }
}

// Função para tentar carregar do GitHub
async function tentarCarregarGitHub() {
  console.log("Tentando carregar do GitHub...");
  
  return new Promise((resolve) => {
    Papa.parse(SHEETS_GITHUB.meta, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: ({ data, errors }) => {
        if (data && data.length > 0 && !errors.length) {
          console.log("✓ DADOS CARREGADOS DO GITHUB");
          console.log("📂 CAMINHO ATIVO: GitHub Repository");
          Object.assign(SHEETS, SHEETS_GITHUB);
          fonteAtual = "github";
          
          // Mostra na interface
          const fonteAtualEl = document.getElementById('fonte-atual');
          if (fonteAtualEl) {
            fonteAtualEl.innerHTML = '📂 GitHub Repository';
          }
          
          resolve({ sucesso: true, data });
        } else {
          resolve({ sucesso: false, erro: "Dados vazios ou com erro" });
        }
      },
      error: (err) => {
        resolve({ sucesso: false, erro: err.message });
      }
    });
  });
}

// Função para tentar carregar dos caminhos locais
async function tentarCarregarLocal() {
  console.log("Tentando carregar de pastas locais...");
  
  for (const caminho of PATHS_LOCAIS) {
    try {
      console.log(`Testando caminho: ${caminho}`);
      
      // Tenta carregar o meta.csv do caminho atual
      const url = caminho + SHEETS_LOCAIS.meta;
      
      const resultado = await new Promise((resolve) => {
        Papa.parse(url, {
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: ({ data, errors }) => {
            if (data && data.length > 0 && !errors.length) {
              resolve({ sucesso: true, data, caminho });
            } else {
              resolve({ sucesso: false, erro: "Dados vazios ou com erro" });
            }
          },
          error: (err) => {
            resolve({ sucesso: false, erro: err.message });
          }
        });
      });
      
      if (resultado.sucesso) {
        console.log(`✓ DADOS CARREGADOS COM SUCESSO DE: ${resultado.caminho}`);
        console.log(`📂 CAMINHO ATIVO: ${resultado.caminho}`);
        
        // Configura as URLs para este caminho
        SHEETS.meta = resultado.caminho + SHEETS_LOCAIS.meta;
        SHEETS.points = resultado.caminho + SHEETS_LOCAIS.points;
        SHEETS.heat = resultado.caminho + SHEETS_LOCAIS.heat;
        SHEETS.linhasTrecho = resultado.caminho + SHEETS_LOCAIS.linhasTrecho;
        
        fonteAtual = "local";
        
        // Mostra na interface qual caminho está sendo usado
        const fonteAtualEl = document.getElementById('fonte-atual');
        if (fonteAtualEl) {
          fonteAtualEl.innerHTML = `📂 Local: ${resultado.caminho}`;
        }
        
        return { sucesso: true, data: resultado.data, caminho: resultado.caminho };
      }
      
    } catch (err) {
      console.log(`Erro no caminho ${caminho}:`, err.message);
    }
  }
  
  console.log("Nenhuma pasta local encontrada");
  return { sucesso: false };
}

// Função para tentar pasta compartilhada
async function tentarCarregarCompartilhada() {
  console.log("Tentando carregar da pasta compartilhada...");
  
  return new Promise((resolve) => {
    Papa.parse(SHEETS_COMPARTILHADA.meta, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: ({ data, errors }) => {
        if (data && data.length > 0 && !errors.length) {
          console.log("✓ DADOS CARREGADOS DA PASTA COMPARTILHADA");
          console.log("🌐 CAMINHO ATIVO: Pasta Compartilhada Online");
          Object.assign(SHEETS, SHEETS_COMPARTILHADA);
          fonteAtual = "compartilhada";
          
          // Mostra na interface
          const fonteAtualEl = document.getElementById('fonte-atual');
          if (fonteAtualEl) {
            fonteAtualEl.innerHTML = '🌐 Pasta Compartilhada';
          }
          
          resolve({ sucesso: true, data });
        } else {
          resolve({ sucesso: false, erro: "Dados vazios ou com erro" });
        }
      },
      error: (err) => {
        resolve({ sucesso: false, erro: err.message });
      }
    });
  });
}

// ═══════════════════════ 4) Carrega metadados com cascata de fontes
async function iniciarCarregamento() {
  const elementoFonte = document.getElementById('fonteAtual');
  
  // 1º: Tenta GitHub (se não estiver rodando localmente)
  if (window.location.protocol === 'https:' || window.location.hostname.includes('github')) {
    if (elementoFonte) elementoFonte.innerHTML = 'Carregando do GitHub...';
    const resultadoGitHub = await tentarCarregarGitHub();
    
    if (resultadoGitHub.sucesso) {
      console.log("✓ Usando dados do GitHub");
      atualizarIndicadorFonte("github");
      processarMetadados(resultadoGitHub.data);
      return;
    }
  }
  
  // 2º: Tenta pastas locais
  if (elementoFonte) elementoFonte.innerHTML = 'Procurando arquivos locais...';
  const resultadoLocal = await tentarCarregarLocal();
  
  if (resultadoLocal.sucesso) {
    console.log("✓ Usando arquivos locais");
    atualizarIndicadorFonte("local", resultadoLocal.caminho);
    processarMetadados(resultadoLocal.data);
    return;
  }
  
  // 3º: Tenta pasta compartilhada
  if (elementoFonte) elementoFonte.innerHTML = 'Tentando pasta compartilhada...';
  const resultadoCompartilhada = await tentarCarregarCompartilhada();
  
  if (resultadoCompartilhada.sucesso) {
    console.log("✓ Usando pasta compartilhada");
    atualizarIndicadorFonte("compartilhada");
    processarMetadados(resultadoCompartilhada.data);
    return;
  }
  
  // 4º: Fallback para Google Sheets
  console.log("⚠️ USANDO GOOGLE SHEETS COMO FALLBACK");
  console.log("☁️ CAMINHO ATIVO: Google Sheets Online");
  if (elementoFonte) elementoFonte.innerHTML = 'Carregando do Google Sheets...';
  Object.assign(SHEETS, SHEETS_FALLBACK);
  fonteAtual = "fallback";
  
  Papa.parse(SHEETS.meta, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: ({ data }) => {
      console.log("✓ DADOS CARREGADOS DO GOOGLE SHEETS");
      
      // Mostra na interface
      const fonteAtualEl = document.getElementById('fonte-atual');
      if (fonteAtualEl) {
        fonteAtualEl.innerHTML = '☁️ Google Sheets';
      }
      
      atualizarIndicadorFonte("fallback");
      processarMetadados(data);
    },
    error: (err) => {
      console.error("❌ Erro mesmo com Google Sheets:", err);
      if (elementoFonte) elementoFonte.innerHTML = 'Erro ao carregar dados. Verifique a conexão.';
      alert("Erro ao carregar dados. Verifique a conexão e tente novamente.");
    }
  });
}

// Função para processar metadados independente da fonte
function processarMetadados(data) {
  console.log("Processando metadados:", data.length, "rodovias");
  data.forEach((r) => {
    // Ajuste para os novos nomes de coluna
    metaRod[r["Rodovia"]] = {
      kmIni: parseFloat(r["Km Inicial"].replace(/,/, ".")),
      kmFim: parseFloat(r["Km Final"].replace(/,/, ".")),
      iniLat: +r["Lat e Long km Inicial"].split(",")[0],
      iniLon: +r["Lat e Long km Inicial"].split(",")[1],
      fimLat: +r["Lat e Long km final"].split(",")[0],
      fimLon: +r["Lat e Long km final"].split(",")[1],
    };
  });
  carregarRC();
}

// ═══════════════════════ 5) Shapefiles das RCs (contorno)
async function carregarRC() {
  const rcList = [
    "data/RC_2.1.zip",
    "data/RC_2.2.zip",
    "data/RC_2.4.zip",
    "data/RC_2.5.zip",
    "data/RC_2.6_2.8.zip",
    "data/RC_2.7.zip",
  ];

  for (const p of rcList) {
    try {
      const geo = await shp(p);
      const name = p.match(/RC_[\d._]+/)[0].replace("_", " ");
      rcLayers[name] = L.geoJSON(geo, {
        pane: "shapefilePane",
        style: { color: "#000", weight: 2.5, fill: false },
      }).addTo(mapa);
      addLabel(rcLayers[name].getBounds().getCenter(), name, "rc-label");
    } catch (err) {
      console.error("RC falhou:", p, err);
    }
  }

  loadMalha();
}

// ═══════════════════════ 6) KMZ único da malha DR.02
async function loadMalha() {
  const MALHA_PATH = "data/malha_dr02.kmz";
  try {
    const resp = await fetch(MALHA_PATH);
    if (!resp.ok) throw new Error(`404 – não achei ${MALHA_PATH}`);

    const zip = await JSZip.loadAsync(await resp.arrayBuffer());
    const kmlFile = Object.keys(zip.files).find((f) => f.toLowerCase().endsWith(".kml"));
    if (!kmlFile) throw new Error(".kml ausente dentro do KMZ");

    const xml = await zip.file(kmlFile).async("string");
    const geo = toGeoJSON.kml(new DOMParser().parseFromString(xml, "text/xml"));

    // Remove labels antigos das rodovias
    rodLabels.forEach((l) => mapa.removeLayer(l));
    rodLabels = [];
    geo.features
      .filter((f) => f.geometry && ["LineString", "MultiLineString"].includes(f.geometry.type))
      .forEach((feat) => {
        const nomeCompleto = (feat.properties?.name || "Rodovia").replaceAll("_", " ").trim();
        // Extrai "SPA 294/250", "SPA 294" ou "SP 250" do nome
        const nome = nomeCompleto.match(/SPA ?\d+\/\d+|SPA ?\d+|SP ?\d+/i)?.[0] || nomeCompleto;
        rodLayers[nomeCompleto] = L.geoJSON(turf.simplify(feat, { tolerance: 0.00005 }), {
          pane: "rodoviasPane",
          style: { color: "#555", weight: 3, opacity: 0.9 },
        }).addTo(mapa);
        // Adiciona o label e armazena referência
        const label = addLabel(rodLayers[nomeCompleto].getBounds().getCenter(), nome, "rod-label");
        rodLabels.push(label);
      });

    mapa.fitBounds(L.featureGroup(Object.values(rodLayers)).getBounds());
    reloadSheets();
    refreshVis();
    // Dispara evento customizado para sinalizar que as rodovias estão prontas
    window.dispatchEvent(new Event('rodoviasCarregadas'));
  } catch (err) {
    console.error("Malha DR.02:", err.message);
  }
}

// ═══════════════════════ 7) Planilhas dinâmicas
function reloadSheets() {
  pontosLayer.clearLayers();
  if (heatLayer) mapa.removeLayer(heatLayer), (heatLayer = null);
  linhasTrechoLayer.clearLayers();
  loadPoints();
  loadHeat();
  loadLinhasTrecho();
}

// --- pontos
function loadPoints() {
  Papa.parse(SHEETS.points, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: ({ data }) => {
      data.forEach((d) => {
        const key = d.Rodovia;
        const seg = rodLayers[key];
        const meta = metaRod[key];
        if (!seg || !meta) return;
        // Usa sempre d.Km para o campo Km
        const km = d.Km !== undefined ? parseFloat(d.Km.toString().replace(",", ".")) : undefined;
        if (!km || km < meta.kmIni || km > meta.kmFim) return;
        const rel = km - meta.kmIni;
        const line = seg.toGeoJSON().features[0];
        const pt = turf.along(line, rel, { units: "kilometers" });
        // Cor
        const cor = d.Cor || "#1976d2";
        // Opacidade
        let opacidade = 1;
        if (d.Opacidade !== undefined && d.Opacidade !== "") {
          const op = parseFloat(d.Opacidade.toString().replace(",", "."));
          if (!isNaN(op) && op >= 0 && op <= 1) opacidade = op;
        }
        // Raio
        let raio = 6;
        if (d.Raio !== undefined && d.Raio !== "") {
          const r = parseFloat(d.Raio.toString().replace(",", "."));
          if (!isNaN(r) && r > 0) raio = r;
        }
        L.circle([pt.geometry.coordinates[1], pt.geometry.coordinates[0]], {
          pane: "overlayPane",
          radius: raio, // agora em metros
          color: cor, // borda igual à cor do preenchimento
          weight: 2,
          opacity: 1, // opacidade da borda
          fill: true,
          fillColor: cor,
          fillOpacity: opacidade,
        })
          .bindPopup(`<b>${key}</b><br>Km ${d.Km}<br>${d.Obs || ""}`)
          .addTo(pontosLayer);
      });
      if (!pointsVisible) mapa.removeLayer(pontosLayer);
    },
  });
}

// --- heatmap
function loadHeat() {
  Papa.parse(SHEETS.heat, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: ({ data }) => {
      const pts = [];
      data.forEach((r) => {
        const seg = rodLayers[r.Rodovia];
        const meta = metaRod[r.Rodovia];
        if (!seg || !meta) return;

        const km0 = parseFloat(r["Km Inicial"].replace(",", "."));
        const km1 = parseFloat(r["Km Final"].replace(",", "."));
        if (!km0 || !km1) return;

        const rel0 = km0 - meta.kmIni;
        const rel1 = km1 - meta.kmIni;
        const line = seg.toGeoJSON().features[0];
        const p0 = turf.along(line, rel0, { units: "kilometers" });
        const p1 = turf.along(line, rel1, { units: "kilometers" });
        const slice = turf.lineSlice(p0, p1, line);
        const len = turf.length(slice, { units: "kilometers" });
        const n = Math.ceil(len * 4) + 1;

        for (let i = 0; i <= n; i++) {
          const p = turf.along(slice, (len * i) / n, { units: "kilometers" });
          pts.push([p.geometry.coordinates[1], p.geometry.coordinates[0], 1]);
        }
      });
      heatLayer = L.heatLayer(pts, { radius: 25, blur: 15 }).addTo(mapa);
      if (!heatVisible) mapa.removeLayer(heatLayer);
    },
  });
}

// --- linhas por trecho
function loadLinhasTrecho() {
  Papa.parse(SHEETS.linhasTrecho, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: ({ data }) => {
      data.forEach((r) => {
        const seg = rodLayers[r.Rodovia];
        const meta = metaRod[r.Rodovia];
        if (!seg || !meta) return;
        const km0 = parseFloat((r["Km Inicial"]||"").replace(",", "."));
        const km1 = parseFloat((r["Km Final"]||"").replace(",", "."));
        if (!km0 || !km1) return;
        const rel0 = km0 - meta.kmIni;
        const rel1 = km1 - meta.kmIni;
        const line = seg.toGeoJSON().features[0];
        const p0 = turf.along(line, rel0, { units: "kilometers" });
        const p1 = turf.along(line, rel1, { units: "kilometers" });
        const slice = turf.lineSlice(p0, p1, line);
        const cor = r.Cor || "#ff0000";
        let espessura = 6;
        if (r.Espessura !== undefined && r.Espessura !== "") {
          const e = parseFloat(r.Espessura.toString().replace(",", "."));
          if (!isNaN(e) && e > 0) espessura = e;
        }
        L.geoJSON(slice, {
          pane: "overlayPane",
          style: { color: cor, weight: espessura, opacity: 1 },
          interactive: false
        }).addTo(linhasTrechoLayer);
      });
    },
    error: (err) => console.error('Erro ao carregar linhas por trecho:', err)
  });
}

// ═══════════════════════ 8) Controles de UI
// Função para evitar sobreposição de labels
function ajustarVisibilidadeLabels() {
  if (!rodLabels.length) return;
  // Pega a posição dos labels na tela
  const positions = rodLabels.map((label) => {
    const latlng = label.getLatLng();
    return mapa.latLngToContainerPoint(latlng);
  });
  // Define um raio mínimo de separação em pixels
  const minDist = 40;
  // Array para controlar quais labels mostrar
  const visiveis = Array(rodLabels.length).fill(true);
  for (let i = 0; i < positions.length; i++) {
    if (!visiveis[i]) continue;
    for (let j = i + 1; j < positions.length; j++) {
      if (!visiveis[j]) continue;
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      if (Math.sqrt(dx * dx + dy * dy) < minDist) {
        visiveis[j] = false; // Oculta o label j
      }
    }
  }
  // Aplica visibilidade
  rodLabels.forEach((label, i) => {
    const el = label.getElement();
    if (el) el.style.display = visiveis[i] ? "" : "none";
  });
}

mapa.on("zoomend moveend", ajustarVisibilidadeLabels);
// Chama ao carregar labels
setTimeout(ajustarVisibilidadeLabels, 1000);

// ═══════════════════════ 9) Controles de visibilidade
let pointsVisible = true;
let heatVisible = true;
let visibilityInitialized = false;

function refreshVis() {
  if (!visibilityInitialized) {
    pointsVisible = true;
    heatVisible = true;
    visibilityInitialized = true;
  }
  
  if (pointsVisible && !mapa.hasLayer(pontosLayer)) mapa.addLayer(pontosLayer);
  if (!pointsVisible && mapa.hasLayer(pontosLayer)) mapa.removeLayer(pontosLayer);
  
  if (heatVisible && heatLayer && !mapa.hasLayer(heatLayer)) mapa.addLayer(heatLayer);
  if (!heatVisible && heatLayer && mapa.hasLayer(heatLayer)) mapa.removeLayer(heatLayer);
}

// Função para tentar carregar da pasta compartilhada quando o usuário clicar
function tentarCarregarPastaCompartilhada() {
  const btn = document.getElementById('btnTentarPastaCompartilhada');
  const fonteAtualEl = document.getElementById('fonteAtual');
  
  if (btn) btn.textContent = 'Testando...';
  if (fonteAtualEl) fonteAtualEl.innerHTML = 'Testando pasta compartilhada...';
  
  // Testa se consegue carregar da pasta compartilhada
  Papa.parse(SHEETS_COMPARTILHADA.meta, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: ({ data }) => {
      if (data && data.length > 0) {
        console.log("Pasta compartilhada disponível! Atualizando...");
        // Atualiza as URLs
        Object.assign(SHEETS, SHEETS_COMPARTILHADA);
        atualizarIndicadorFonte("compartilhada");
        
        if (btn) {
          btn.textContent = '✓ Sucesso! Recarregando...';
          btn.style.background = '#4caf50';
        }
        
        // Recarrega os dados da pasta compartilhada
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        console.log("Pasta compartilhada retornou dados vazios");
        if (btn) {
          btn.textContent = 'Dados vazios - mantendo atual';
          btn.style.background = '#ff9800';
        }
        setTimeout(() => resetarBotao(btn), 3000);
      }
    },
    error: (err) => {
      console.log("Pasta compartilhada não disponível:", err.message);
      if (btn) {
        btn.textContent = 'Erro - mantendo atual';
        btn.style.background = '#f44336';
      }
      setTimeout(() => resetarBotao(btn), 3000);
    }
  });
}

// Função para resetar botão
function resetarBotao(btn) {
  if (btn) {
    btn.textContent = 'Tentar Pasta Compartilhada';
    btn.style.background = 'linear-gradient(90deg, #1976d2 60%, #42a5f5 100%)';
  }
}

// Inicia o carregamento
iniciarCarregamento();
