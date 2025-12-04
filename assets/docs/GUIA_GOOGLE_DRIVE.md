# 📁 Guia: Sistema Colaborativo com Google Drive

## 🎯 **Visão Geral**

Sistema simples onde as planilhas CSV ficam em uma **pasta compartilhada do Google Drive** e o site carrega automaticamente os dados atualizados.

## 📋 **Configuração Inicial (Apenas Rodrigo)**

### **Passo 1: Criar Pasta Compartilhada**

1. Acesse [Google Drive](https://drive.google.com)
2. Clique com botão direito → **"Nova pasta"**
3. Nome: **"DR02 - Planilhas Colaborativas"**
4. Clique com botão direito na pasta → **"Compartilhar"**
5. Adicionar emails dos 4 usuários:
   - rodrigo@example.com (Proprietário)
   - eloizo@example.com (Editor)
   - marlon@example.com (Editor)
   - khayan@example.com (Editor)

### **Passo 2: Upload dos 3 Arquivos CSV**

Fazer upload dentro da pasta compartilhada:

```
📁 DR02 - Planilhas Colaborativas/
├── 📊 linhas_por_trecho.csv
├── 📊 mapa_de_calor.csv
└── 📊 pontos_de_interesse.csv
```

### **Passo 3: Tornar Arquivos Públicos**

Para cada arquivo CSV:

1. **Clique com botão direito** → **"Compartilhar"**
2. Clique em **"Alterar"** (ao lado de "Restrito")
3. Selecionar **"Qualquer pessoa com o link"**
4. Permissão: **"Visualizador"**
5. Clique **"Concluído"**
6. **Copiar o link compartilhável**

### **Passo 4: Extrair IDs dos Arquivos**

Para cada link copiado, extrair o ID:

**Exemplo de link:**
```
https://drive.google.com/file/d/1ABC123XYZ789/view?usp=sharing
```

**ID extraído:**
```
1ABC123XYZ789
```

### **Passo 5: Atualizar o Código** ✅

Editar `src/js/script_colaborativo.js`:

```javascript
const CSV_URLS = {
  linhasPorTrecho: 'https://drive.google.com/uc?export=download&id=1r-7wdW8IwNhDMmGJ_QoflML-Mo1wvgAuw6ILK_LFlpo',
  mapaDeCalor: 'https://drive.google.com/uc?export=download&id=1IcM6qrF9JpZlJ6c6P1pvb8O5bhmdgDz4gKCtf8V2JUg', 
  pontosDeInteresse: 'https://drive.google.com/uc?export=download&id=1Zxrq6L68fkTuygCE6yVVLOb9wU0UhoQfQHOMm_Xr8RI'
};
```

Editar `src/index.html` (linha ~312):

```javascript
const CSV_PONTOS_URL = "https://drive.google.com/uc?export=download&id=1Zxrq6L68fkTuygCE6yVVLOb9wU0UhoQfQHOMm_Xr8RI";
```

**🎯 STATUS: CONFIGURADO! ✅**

## 👥 **Fluxo de Trabalho dos Usuários**

### **🔄 Como Cada Usuário Edita:**

#### **Opção A: Direto no Google Drive (Recomendado)**
1. Acessar a pasta compartilhada no Google Drive
2. Abrir o CSV desejado (abre no Google Sheets)
3. Editar os dados
4. **Arquivo → Download → Valores separados por vírgula (.csv)**
5. Fazer upload do arquivo atualizado (substituir o anterior)

#### **Opção B: Excel Local**
1. Baixar o CSV da pasta compartilhada
2. Abrir no Excel/LibreOffice
3. Fazer as edições necessárias
4. **Salvar como CSV** (manter formato)
5. Fazer upload do arquivo atualizado na pasta compartilhada

### **⚡ Vantagens do Sistema:**

✅ **Sem instalação** - Funciona direto no navegador  
✅ **Acesso simples** - Qualquer um com link pode editar  
✅ **Versionamento** - Google Drive mantém histórico  
✅ **Sincronização automática** - Site atualiza em tempo real  
✅ **Backup automático** - Google Drive é seguro  
✅ **Mobile friendly** - Pode editar pelo celular  

### **📊 Estrutura dos CSVs:**

#### **linhas_por_trecho.csv**
```csv
rodovia,km_inicial,km_final,cor,espessura
SP-129,0,10,#FF0000,3
SP-160,15,25,#00FF00,2
```

#### **mapa_de_calor.csv**
```csv
rodovia,km_inicial,km_final
SP-129,5,15
SP-160,20,30
```

#### **pontos_de_interesse.csv**
```csv
rodovia,km,obs,cor,opacidade,raio
SP-129,12.5,Posto de combustível,#FFFF00,0.8,50
SP-160,22.3,Restaurante,#FF8800,0.7,30
```

## 🔧 **Troubleshooting**

### **CSV não carrega:**
- Verificar se o arquivo está público ("Qualquer pessoa com o link")
- Confirmar se o ID está correto no código
- Testar URL manualmente no navegador

### **Dados não aparecem no site:**
- Verificar formato do CSV (cabeçalhos corretos)
- Conferir se não há linhas vazias
- Usar console do navegador (F12) para ver erros

### **Permissões de edição:**
- Confirmar se usuário tem acesso à pasta compartilhada
- Verificar se tem permissão de "Editor" na pasta

## 🌐 **URLs Importantes**

- **Site ao vivo:** https://rodrigohenriquecc.github.io/dr02-map-site
- **Pasta compartilhada:** [Link será fornecido após criação]
- **Repositório GitHub:** https://github.com/rodrigohenriquecc/dr02-map-site

---

**🎯 Resultado:** Sistema colaborativo simples onde cada usuário pode editar CSVs via Google Drive e o site atualiza automaticamente!
