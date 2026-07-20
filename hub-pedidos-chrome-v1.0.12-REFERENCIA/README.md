# Hub de Pedidos - Extensão Chrome

Automação completa do fluxo de compras: **Trello → Google Drive → Bessani → Trello → WhatsApp**

## 📋 O que faz

1. **Lista fornecedores** do Trello (lista: "RELAÇÃO E PEDIDOS RIO CLARO/ARARAS")
2. **Extrai dados** da planilha Google Sheets de cada fornecedor (código, descrição, quantidade)
3. **Aguarda print** do Bessani (você cola a imagem)
4. **Atualiza card Trello** com:
   - Descrição formatada (código | descrição | quantidade + timestamp)
   - Data do pedido
   - Data de entrega
   - Etiqueta "Pedido Enviado"
   - Anexa print do Bessani
5. **Monta mensagem WhatsApp** (template fixo, você edita antes de enviar)
6. **Busca fornecedor** no WhatsApp (por nome/etiqueta)
7. **Aguarda resposta** antes de próximo fornecedor
8. **Loop** até zerar lista

---

## 🚀 Instalação

### Opção A: Instalação Manual (Recomendado)

1. **Baixe os arquivos:**
   - Crie uma pasta: `hub-pedidos-chrome`
   - Copie todos os arquivos `.js`, `.html`, `.json` para lá

2. **No Chrome, acesse:** `chrome://extensions/`

3. **Ative "Modo de desenvolvedor"** (canto superior direito)

4. **Clique em "Carregar extensão sem empacotamento"**

5. **Selecione a pasta** `hub-pedidos-chrome`

6. **Pronto!** A extensão aparecerá na barra de ferramentas

### Opção B: Instalar Como Arquivo Único

Use o arquivo `hub-pedidos-launcher.html` - ele pode ser aberto direto no navegador sem instalação.

---

## 📖 Como Usar

### Passo 1: Iniciar
1. Clique no ícone da extensão (barra de ferramentas)
2. Clique em "Iniciar Automação"
3. Aguarde abrir as 3 abas (Trello, Drive, WhatsApp)
4. Clique em "Confirmar e Começar"

### Passo 2: Para Cada Fornecedor

#### Etapa 1: Extração Google Drive
- A extensão busca automaticamente a planilha
- Extrai: código, descrição, quantidade (mês atual)
- ✅ Dados aparecem na tela

#### Etapa 2: Print Bessani
- **Cole o print** do Bessani (Ctrl+V) no campo ou faça upload
- **Preencha os dados:**
  - Número do pedido
  - Data pedido (DD/MM/YYYY)
  - Data entrega (DD/MM/YYYY)
- Clique em "Confirmar Dados"

#### Etapa 3: Atualizar Trello
- A extensão atualiza automaticamente o card:
  - Descrição com código | desc | qty + timestamp
  - Datas (pedido e entrega)
  - Etiqueta "Pedido Enviado"
  - Anexa print Bessani

#### Etapa 4: WhatsApp
- **Edite a mensagem** se necessário:
  ```
  Segue pedido de compra. Aguardo retorno com a previsão de entrega. Obrigada, Ciça
  ```
- Clique em "Abrir WhatsApp"
- Selecione o fornecedor (busca por etiqueta ou nome)
- Cole a mensagem (Ctrl+V)
- **Envie no WhatsApp**
- Aguarde resposta
- Clique em "Próximo Fornecedor" aqui na extensão

#### Loop
A extensão repete para o próximo fornecedor até zerar a lista

---

## 🔗 Links Necessários

Já estão configurados na extensão:

- **Trello:** https://trello.com/b/UfPrTr1H/compras
- **Google Drive:** https://drive.google.com/drive/u/0/folders/1P7Nb1FwfSQ6e7TA9Wkgizyy53tGGQajk
- **WhatsApp Web:** https://web.whatsapp.com/

---

## ⚙️ Estrutura de Arquivos

```
hub-pedidos-chrome/
├── manifest.json          # Configuração da extensão
├── popup.html             # Interface do popup
├── popup.js               # Lógica principal
├── background.js          # Service worker
├── content-trello.js      # Interação com Trello
├── content-drive.js       # Interação com Google Drive/Sheets
├── content-whatsapp.js    # Interação com WhatsApp Web
└── README.md              # Este arquivo
```

---

## 🐛 Troubleshooting

### "Extensão não aparece"
- Verifique se está em `chrome://extensions/`
- Ative "Modo de desenvolvedor"
- Atualize a página se não carregar

### "Fornecedores não listam"
- Certifique-se de que Trello carregou totalmente
- Verifique se a lista "RELAÇÃO E PEDIDOS RIO CLARO/ARARAS" existe e tem cards
- Aguarde 2-3 segundos e tente novamente

### "Planilha não encontra dados"
- Abra manualmente a planilha do fornecedor no Google Sheets
- Verifique se tem colunas: Código (B), Descrição (D), Mês Corrente (última coluna)
- A extensão tenta extrair automaticamente após abrir

### "Print não cola"
- Use Ctrl+V direto no navegador
- Certifique-se que copiou a imagem (não o link)
- Ou use o campo de upload "Selecionar arquivo"

### "Trello não atualiza"
- Verifique se o card está aberto na aba correta
- Espere o card abrir completamente antes de clicar em "Confirmar"
- Se ficar lento, feche abas desnecessárias

### "WhatsApp não encontra fornecedor"
- Verifique o nome/etiqueta no WhatsApp Web
- Tente buscar manualmente no WhatsApp antes de usar a extensão
- A busca é case-sensitive (diferenciar maiúsculas)

---

## 📝 Notas

- **Sem OCR:** Você digita os dados do Bessani (é rápido!)
- **Timestamps automáticos:** Data/hora são adicionadas automaticamente
- **Loop sem pausa:** Processa até zerar ou você parar manualmente
- **Seguro:** Nenhum dado é enviado para fora - tudo roda localmente no seu Chrome

---

## 🆘 Suporte

Se tiver problemas:
1. Verifique os links estão acessíveis
2. Confirme que está logado em Trello, Google Drive e WhatsApp Web
3. Abra o console (F12 > Console) e copie erros
4. Reinicie a extensão (descarregue e carregue novamente)

---

**Versão:** 1.0.0  
**Última atualização:** Julho 2026

