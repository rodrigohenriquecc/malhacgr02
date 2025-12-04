// Variáveis globais para os filtros
let dadosFiltrados = [];
let filtrosAtivos = {
    rodovia: '',
    empresa: '',
    periodo: ''
};

// Helper: obtém valor de campo tentando várias chaves (case-insensitive / parcial)
function obterCampo(linha, candidates) {
    if (!linha) return undefined;
    const keys = Object.keys(linha || {});

    // Normaliza string (remove acentos e converte para lowercase)
    function normalizeStr(s) {
        if (s === undefined || s === null) return '';
        try {
            return String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
        } catch (e) {
            // Fallback para ambientes que não suportam \p{Diacritic}
            return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        }
    }

    // Tentativa direta por chaves (exatas)
    for (const c of candidates) {
        if (linha[c] !== undefined) return linha[c];
    }

    // Mapeia chaves normalizadas -> chave original
    const normalizedMap = keys.reduce((acc, k) => { acc[normalizeStr(k)] = k; return acc; }, {});

    for (const c of candidates) {
        const nc = normalizeStr(c);
        // busca exata na versão normalizada
        if (normalizedMap[nc]) return linha[normalizedMap[nc]];
        // busca parcial: qualquer chave que contenha o termo normalizado
        const foundKey = keys.find(k => normalizeStr(k).includes(nc));
        if (foundKey) return linha[foundKey];
    }

    return undefined;
}

// Função para inicializar os filtros
function inicializarFiltros() {
    // Elementos dos filtros
    const filtroRodovia = document.getElementById('filtroRodovia');
    const filtroEmpresa = document.getElementById('filtroEmpresa');
    const filtroPeriodo = document.getElementById('filtroPeriodo');
    const btnAplicar = document.getElementById('btnAplicarFiltros');
    const btnLimpar = document.getElementById('btnLimparFiltros');

    // Determina a fonte de dados disponível
    function obterFonte() {
        if (window.dados && Array.isArray(window.dados.linhasPorTrecho)) return window.dados.linhasPorTrecho;
        if (window.dadosPlanilhaOficial && Array.isArray(window.dadosPlanilhaOficial)) return window.dadosPlanilhaOficial;
        return [];
    }

    // Carregar valores únicos para cada filtro (robusto a diferentes schemas)
    function carregarValoresUnicos() {
        const rodovias = new Set();
        const empresas = new Set();
        const periodos = new Set();

        const fonte = obterFonte();

        // Logs de depuração: mostra amostra e chaves detectadas
        try {
            console.log('filtros: fonte.length =', fonte ? fonte.length : 0);
            if (fonte && fonte.length) {
                console.log('filtros: primeiros 3 registros (amostra):', fonte.slice(0,3));
                console.log('filtros: chaves detectadas no primeiro registro:', Object.keys(fonte[0] || {}));
            }
        } catch (e) {
            console.warn('filtros: erro ao logar amostra de dados', e);
        }

        // Indices de colunas conforme sua planilha: A=0, F=5, G=6
        const COL_IDX = { RODOVIA: 0, PERIODO: 5, EMPRESA: 6 };

        // Flags para saber qual estratégia foi usada (nome de coluna ou índice)
        let usadasPorNome = { rodovia: false, periodo: false, empresa: false };

        fonte.forEach(linha => {
            // Tenta por nomes conhecidos primeiro (são insensíveis a acentos e caso)
            let rod = obterCampo(linha, ['RODOVIAS', 'RODOVIA', 'Rodovias', 'Rodovia', 'SP']);
            let per = obterCampo(linha, ['PERIODO', 'PERÍODO', 'Período', 'Periodo', 'F']);
            let emp = obterCampo(linha, ['EMPRESA', 'Empresa', 'CONCESSIONARIA', 'CONCESSIONÁRIA', 'CONCESSIONÁRIA']);

            // Se não encontrou por nome, tenta por índice (posição da coluna na planilha CSV)
            const valores = Object.values(linha || {});
            if ((rod === undefined || String(rod).trim() === '') && valores.length > COL_IDX.RODOVIA) {
                rod = valores[COL_IDX.RODOVIA];
            } else if (rod !== undefined) {
                usadasPorNome.rodovia = true;
            }

            if ((per === undefined || String(per).trim() === '') && valores.length > COL_IDX.PERIODO) {
                per = valores[COL_IDX.PERIODO];
            } else if (per !== undefined) {
                usadasPorNome.periodo = true;
            }

            if ((emp === undefined || String(emp).trim() === '') && valores.length > COL_IDX.EMPRESA) {
                emp = valores[COL_IDX.EMPRESA];
            } else if (emp !== undefined) {
                usadasPorNome.empresa = true;
            }

            if (rod && String(rod).trim().length) rodovias.add(String(rod).trim());
            if (emp && String(emp).trim()) empresas.add(String(emp).trim());
            if (per && String(per).trim()) periodos.add(String(per).trim());
        });

        // Log informativo para depuração (remova em produção se desejar)
        console.log('Filtros: usando por nome?', usadasPorNome, 'Tamanhos:', {
            rodovias: rodovias.size,
            periodos: periodos.size,
            empresas: empresas.size
        });

        // Preencher selects
        preencherSelect(filtroRodovia, Array.from(rodovias).sort());
        preencherSelect(filtroEmpresa, Array.from(empresas).sort());
        preencherSelect(filtroPeriodo, Array.from(periodos).sort());
    }

    // Função auxiliar para preencher selects
    function preencherSelect(select, valores) {
        if (!select) return;
        const valorAtual = select.value;
        select.innerHTML = '<option value="">Todos</option>';
        valores.forEach(valor => {
            const option = document.createElement('option');
            option.value = valor;
            option.textContent = valor;
            select.appendChild(option);
        });
        // tenta restaurar valor anterior se ainda existir
        if (valorAtual) select.value = valorAtual;
    }

    // Função para aplicar os filtros
    function aplicarFiltros() {
        filtrosAtivos = {
            rodovia: filtroRodovia ? filtroRodovia.value : '',
            empresa: filtroEmpresa ? filtroEmpresa.value : '',
            periodo: filtroPeriodo ? filtroPeriodo.value : ''
        };

        const fonte = obterFonte();
        dadosFiltrados = fonte.filter(linha => {
            const rod = obterCampo(linha, ['RODOVIA', 'Rodovia', 'SP']);
            const emp = obterCampo(linha, ['EMPRESA', 'Empresa']);
            const per = obterCampo(linha, ['PERIODO', 'Período', 'Periodo']);

            return (!filtrosAtivos.rodovia || String(rod) === filtrosAtivos.rodovia) &&
                   (!filtrosAtivos.empresa || String(emp) === filtrosAtivos.empresa) &&
                   (!filtrosAtivos.periodo || String(per) === filtrosAtivos.periodo);
        });

        // Atualiza a visualização se a função existir
        if (typeof renderizarLinhasPorTrecho === 'function') renderizarLinhasPorTrecho(dadosFiltrados);
        if (typeof mostrarNotificacao === 'function') mostrarNotificacao(`✅ ${dadosFiltrados.length} trechos encontrados`, 'info');
    }

    // Função para limpar os filtros
    function limparFiltros() {
        if (filtroRodovia) filtroRodovia.value = '';
        if (filtroEmpresa) filtroEmpresa.value = '';
        if (filtroPeriodo) filtroPeriodo.value = '';
        
        filtrosAtivos = { rodovia: '', empresa: '', periodo: '' };

        const fonte = obterFonte();
        if (typeof renderizarLinhasPorTrecho === 'function') renderizarLinhasPorTrecho(fonte);
        if (typeof mostrarNotificacao === 'function') mostrarNotificacao('🔄 Filtros limpos', 'info');
    }

    // Event Listeners
    if (filtroRodovia) filtroRodovia.addEventListener('change', () => { carregarValoresUnicos(); });
    if (btnAplicar) btnAplicar.addEventListener('click', aplicarFiltros);
    if (btnLimpar) btnLimpar.addEventListener('click', limparFiltros);

    // Carregar valores iniciais (aguarda dados se necessário)
    function aguardarFonte() {
        const fonte = obterFonte();
        if (!fonte || !fonte.length) {
            // tenta novamente em 100ms até que os dados sejam carregados
            setTimeout(aguardarFonte, 100);
            return;
        }
        carregarValoresUnicos();
    }
    aguardarFonte();
}

// Exporta as funções necessárias
window.inicializarFiltros = inicializarFiltros;