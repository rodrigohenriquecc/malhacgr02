# 🗺️ DR.02 - Sistema Colaborativo de Mapeamento de Rodovias

Sistema interativo para visualização e gerenciamento colaborativo de dados rodoviários do DR.02, com validação automática e deploy contínuo.

## 👥 **Usuários Autorizados**

- **Rodrigo** - Administrador do sistema
- **Eloizo** - Analista de dados
- **Marlon** - Especialista em rodovias  
- **Khayan** - Coordenador técnico

> Todos os usuários têm permissão de escrita no repositório e podem editar os dados.

## 📂 **Estrutura do Projeto**

```
dr02-map-site/
├── .github/workflows/
│   └── deploy.yml                    # CI/CD automático
├── data/                            # 📊 Dados CSV (editáveis)
│   ├── linhas_por_trecho.csv        # Trechos de rodovias
│   ├── mapa_de_calor.csv           # Dados do mapa de calor
│   └── pontos_de_interesse.csv     # Pontos específicos
├── src/                            # 🌐 Código do site
│   ├── index.html                  # Página principal
│   ├── css/                        # Estilos
│   └── js/                         # Scripts do mapa
├── scripts/
│   └── validar-csv.js              # Validação automática
├── package.json                    # Dependências Node.js
└── README.md                       # Esta documentação
```

## 📊 **Formato dos Dados CSV**

### `linhas_por_trecho.csv`
```csv
rodovia,km_inicial,km_final,cor,espessura
SP-129,0,10,#FF0000,3
SP-160,15,25,#00FF00,2
```
- **rodovia**: Nome da rodovia (string)
- **km_inicial**: Quilômetro inicial (número)
- **km_final**: Quilômetro final (número, > km_inicial)
- **cor**: Cor hexadecimal (#RRGGBB)
- **espessura**: Espessura da linha (1-10)

### `mapa_de_calor.csv`
```csv
rodovia,km_inicial,km_final
SP-129,5,15
SP-160,20,30
```
- **rodovia**: Nome da rodovia (string)
- **km_inicial**: Quilômetro inicial (número)
- **km_final**: Quilômetro final (número, > km_inicial)

### `pontos_de_interesse.csv`
```csv
rodovia,km,obs,cor,opacidade,raio
SP-129,12.5,Posto de combustível,#FFFF00,0.8,50
SP-160,22.3,Restaurante,#FF8800,0.7,30
```
- **rodovia**: Nome da rodovia (string)
- **km**: Quilômetro exato (número)
- **obs**: Observação/descrição (string)
- **cor**: Cor hexadecimal (#RRGGBB)
- **opacidade**: Transparência (0.0-1.0)
- **raio**: Raio do ponto em metros (1-1000)

## 🚀 **Como Colaborar**

### **1. Preparação Inicial**
```bash
# Clone o repositório
git clone https://github.com/rodrigohenriquecc/dr02-map-site.git
cd dr02-map-site

# Instale as dependências
npm install
```

### **2. Fluxo de Trabalho**

#### **📝 Convenção de Branches**
Sempre crie uma branch específica para suas alterações:
```bash
# Formato: usuario-assunto
git checkout -b rodrigo-linhas-sp129
git checkout -b eloizo-pontos-interesse
git checkout -b marlon-calor-sp160
git checkout -b khayan-correcao-dados
```

#### **✏️ Editando os Dados**
1. **Edite os arquivos CSV** em `/data/` com seu editor preferido
2. **Valide localmente** antes de enviar:
   ```bash
   npm run validate
   ```
3. **Se houver erros**, corrija-os e valide novamente

#### **📤 Enviando Alterações**
```bash
# 1. Adicione os arquivos modificados
git add data/

# 2. Faça commit com mensagem descritiva
git commit -m "✨ Adicionar novos pontos de interesse na SP-129
   
   - Adicionados 3 postos de combustível
   - Incluído restaurante no km 25.3
   - Corrigida cor do ponto no km 18.7"

# 3. Envie a branch
git push origin sua-branch
```

#### **🔄 Criando Pull Request**
1. Acesse o repositório no GitHub
2. Clique em **"Compare & pull request"**
3. **Título**: Resumo claro da alteração
4. **Descrição**: Detalhe o que foi modificado e por quê
5. Clique em **"Create pull request"**

#### **✅ Aprovação e Merge**
- O **GitHub Actions** validará automaticamente os CSVs
- Se houver erros, corrija e faça novo commit na mesma branch
- Após aprovação, faça o **merge** para `main`
- O site será atualizado automaticamente em 2-3 minutos

## 🔍 **Validação Automática**

O sistema valida automaticamente:
- ✅ **Cabeçalhos corretos** em cada CSV
- ✅ **Tipos de dados** (números vs strings)
- ✅ **Valores obrigatórios** não vazios
- ✅ **Regras específicas**:
  - km_inicial < km_final
  - Cores no formato hexadecimal
  - Opacidade entre 0 e 1
  - Espessura entre 1 e 10
  - Raio entre 1 e 1000

## 🛠️ **Comandos Úteis**

```bash
# Validar CSVs localmente
npm run validate

# Verificar status do Git
git status

# Ver diferenças nos arquivos
git diff

# Atualizar branch local com main
git checkout main
git pull origin main

# Deletar branch após merge
git branch -d nome-da-branch
```

## 🌐 **Acesso ao Site**

- **URL de Produção**: https://rodrigohenriquecc.github.io/dr02-map-site
- **Dados**: Os CSVs são carregados automaticamente da pasta `/data/`
- **Atualização**: O site é atualizado automaticamente após merge na `main`

## ⚠️ **Importante**

1. **Sempre valide** localmente com `npm run validate` antes de enviar
2. **Use branches específicas** para cada alteração
3. **Mensagens de commit** devem ser descritivas
4. **Teste as alterações** no site após o deploy
5. **Coordene grandes mudanças** com a equipe

## 📞 **Suporte**

Em caso de dúvidas ou problemas:
1. Verifique os logs do GitHub Actions na aba "Actions"
2. Execute `npm run validate` para ver erros específicos
3. Consulte este README para convenções
4. Entre em contato com Rodrigo para questões técnicas

---

🎯 **Objetivo**: Manter os dados sempre atualizados e válidos, com colaboração eficiente entre toda a equipe!
