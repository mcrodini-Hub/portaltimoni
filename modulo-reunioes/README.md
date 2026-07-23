# Módulo Reuniões

Aplicativo web estático (HTML/CSS/JS, sem build) para gerenciar reuniões:
agendamento, lista de participantes, próximas/histórico e registro de atas
(decisões). As reuniões são armazenadas no **Google Calendar** e as atas no
**Google Sheets** — não há backend próprio, tudo roda no navegador com
autenticação OAuth do próprio usuário.

## Funcionalidades

- Agendar reuniões (título, data/hora, local ou link, pauta e participantes).
- Lista de participantes por reunião (convidados do evento no Calendar).
- Lista de próximas reuniões e histórico de reuniões passadas.
- Registro de atas (decisões) vinculadas a cada reunião, gravadas em uma
  planilha do Google Sheets.

## Configuração (uma vez)

### 1. Criar projeto no Google Cloud

1. Acesse https://console.cloud.google.com/ e crie um projeto (ou use um existente).
2. Em **APIs e serviços → Biblioteca**, habilite:
   - **Google Calendar API**
   - **Google Sheets API**

### 2. Criar credenciais OAuth

1. Em **APIs e serviços → Tela de consentimento OAuth**, configure o app
   (tipo "Externo" ou "Interno", conforme sua organização) e adicione os
   escopos `.../auth/calendar.events` e `.../auth/spreadsheets`.
2. Em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**.
   - Em **Origens JavaScript autorizadas**, adicione a URL onde este app
     será servido (ex: `http://localhost:8080` ou o domínio de hospedagem).
   - Copie o **Client ID** gerado.
3. (Opcional, só é necessário se quiser usar chamadas públicas sem OAuth)
   Em **Criar credenciais → Chave de API**, gere uma **API Key** e restrinja
   seu uso às APIs do Calendar/Sheets.

### 3. Criar a planilha de atas

1. Crie uma planilha no Google Sheets.
2. Crie uma aba chamada `Atas` (ou o nome que preferir) com o cabeçalho na
   primeira linha, nesta ordem de colunas:

   | EventId | Data da reunião | Título | Participantes | Decisões/Notas | Registrado em |
   |---|---|---|---|---|---|

3. Copie o **ID da planilha** — é o trecho da URL entre `/d/` e `/edit`:
   `https://docs.google.com/spreadsheets/d/SEU_SPREADSHEET_ID/edit`

### 4. Preencher `js/config.js`

Edite `modulo-reunioes/js/config.js` e preencha:

```js
CLIENT_ID: 'xxxx.apps.googleusercontent.com',
API_KEY: 'sua-api-key',
SPREADSHEET_ID: 'id-da-planilha',
SHEET_NAME: 'Atas', // nome da aba criada no passo 3
```

## Rodando localmente

Como é um app estático, basta servir a pasta com qualquer servidor HTTP
(não abra o `index.html` direto com `file://`, pois o OAuth do Google exige
uma origem `http(s)://`):

```bash
cd modulo-reunioes
python3 -m http.server 8080
```

Depois acesse `http://localhost:8080` (essa URL precisa estar cadastrada em
**Origens JavaScript autorizadas** no passo 2 acima).

## Estrutura

```
modulo-reunioes/
├── index.html          # shell da aplicação (abas, formulários, modal de ata)
├── css/styles.css
├── js/
│   ├── config.js       # credenciais e IDs (preencher manualmente)
│   ├── auth.js         # login/logout via Google Identity Services
│   ├── calendar.js      # agendar/listar reuniões (Google Calendar API)
│   ├── sheets.js        # gravar/ler atas (Google Sheets API)
│   └── app.js           # lógica de UI e integração entre os módulos acima
└── README.md
```
