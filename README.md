# CGR 02 - Sistema de Localização

Sistema de mapeamento e localização de rodovias com interface web interativa.

## 📁 Estrutura do Projeto

```
📁 Site Completo/
├── index.html                    ← Arquivo principal (abrir no navegador)
├── favicon.ico                   ← Ícone do site
├── package.json                  ← Configurações do projeto
├── 📁 assets/                    ← Recursos organizados
│   ├── 📁 css/                   ← Estilos
│   │   └── style.css
│   ├── 📁 js/                    ← Scripts JavaScript
│   │   ├── script_colaborativo.js  ← Script principal
│   │   ├── script_backup.js         ← Backup do script
│   │   └── script.js                ← Script alternativo
│   ├── 📁 data/                  ← Dados e arquivos CSV
│   │   ├── PLANILHA BI - OFICIAL.csv ← Dados principais
│   │   ├── meta.csv                  ← Metadados das rodovias
│   │   ├── *.kmz                     ← Arquivos KMZ
│   │   └── *.zip                     ← Arquivos compactados
│   └── 📁 docs/                  ← Documentação
│       ├── README.md
│       ├── GUIA_GOOGLE_DRIVE.md
│       └── *.md
└── 📁 scripts/                   ← Scripts utilitários
    └── validar-csv.js
```

## 🚀 Como Usar

1. **Abrir o site**: Clique duas vezes em `index.html`
2. **Filtrar rodovias**: Use o painel lateral esquerdo
3. **Acessar planilhas**: Use os botões no canto superior direito

## 📋 Funcionalidades

- ✅ Mapeamento interativo de rodovias
- ✅ Filtro por rodovia e quilometragem
- ✅ Visualização de pontos de interesse
- ✅ Links diretos para Google Sheets
- ✅ Interface responsiva (mobile/desktop)

## 🛠️ Para Publicação

- **Arquivo principal**: `index.html` (manter na raiz)
- **Recursos**: Pasta `assets/` (pode ser enviada junto)
- **Opcional**: Pastas `scripts/`, `src/`, `.github/`, `.vscode/`

## 📊 Dados

O sistema usa exclusivamente dados da **PLANILHA BI - OFICIAL.csv** localizada em `assets/data/`.

---

**Desenvolvido para CGR 02 - Sistema de Localização**
