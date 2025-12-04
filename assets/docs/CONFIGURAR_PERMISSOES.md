# 🔧 Como Configurar Permissões das Planilhas

## ❌ **PROBLEMA ATUAL**
As planilhas não estão públicas, causando erro "Erro ao carregar dados" no site.

## ✅ **SOLUÇÃO: Tornar Planilhas Públicas**

### **Para CADA uma das 3 planilhas abaixo:**

#### **📋 1. Pontos de Interesse**
- **Link:** https://docs.google.com/spreadsheets/d/1Zxrq6L68fkTuygCE6yVVLOb9wU0UhoQfQHOMm_Xr8RI/edit?usp=sharing

#### **📋 2. Linhas por Trecho** 
- **Link:** https://docs.google.com/spreadsheets/d/1r-7wdW8IwNhDMmGJ_QoflML-Mo1wvgAuw6ILK_LFlpo/edit?usp=sharing

#### **📋 3. Mapa de Calor**
- **Link:** https://docs.google.com/spreadsheets/d/1IcM6qrF9JpZlJ6c6P1pvb8O5bhmdgDz4gKCtf8V2JUg/edit?usp=sharing

---

## 🛠️ **PASSOS PARA CONFIGURAR (REPETIR PARA TODAS AS 3):**

### **1. Abrir a Planilha**
- Clique no link da planilha acima
- Faça login na sua conta Google (se necessário)

### **2. Configurar Compartilhamento**
- Clique no botão **"Compartilhar"** (azul, canto superior direito)
- Na janela que abrir, clique em **"Alterar para qualquer pessoa com o link"**

### **3. Definir Permissão**
- Selecione **"Leitor"** no menu suspenso (não "Editor")
- Clique em **"Concluído"**

### **4. Verificar Status**
- O status deve mostrar: **"Qualquer pessoa na internet com este link pode visualizar"**

---

## 🧪 **COMO TESTAR SE FUNCIONOU:**

### **Opção 1: Teste Manual**
1. Abra uma aba anônima/privada no navegador
2. Cole este link de teste (substitua o ID):
   ```
   https://drive.google.com/uc?export=download&id=SEU_ID_AQUI
   ```
3. Se baixar um arquivo CSV, está funcionando!

### **Opção 2: Teste no Site**
1. Acesse o site: https://rodrigohenriquecc.github.io/dr02-map-site
2. Clique no botão **"🔄 Recarregar Dados"**
3. Se aparecer **"✅ Dados atualizados com sucesso!"**, funcionou!

---

## 🚨 **IMPORTANTE:**

- ⚠️ **NÃO dê permissão de "Editor"** para "qualquer pessoa" - isso permitiria que qualquer um editasse
- ✅ **Use apenas "Leitor"** para acesso público
- 👥 **Para os 4 usuários (Rodrigo, Eloizo, Marlon, Khayan)**: continue usando permissão de "Editor" específica por email

---

## 🔍 **TROUBLESHOOTING:**

### **Se ainda não funcionar:**
1. **Limpe cache** do navegador (Ctrl+F5)
2. **Aguarde 2-5 minutos** para propagação das alterações
3. **Verifique novamente** se está "qualquer pessoa com o link"

### **Erros comuns:**
- **"Acesso negado"** = Planilha ainda não está pública
- **"HTML ao invés de CSV"** = Redirecionamento para login (não público)
- **"Failed to fetch"** = Problema de conexão internet

---

## 📞 **SUPORTE:**
Se ainda tiver problemas, envie print da tela de compartilhamento da planilha mostrando as configurações.
