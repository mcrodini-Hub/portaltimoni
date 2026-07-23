// Configuração do Módulo Reuniões.
// Preencha os valores abaixo seguindo o passo a passo do README.md
// (criação do projeto no Google Cloud, credenciais OAuth e planilha de atas).

const REUNIOES_CONFIG = {
  // Client ID OAuth 2.0 (tipo "Aplicativo da Web") criado no Google Cloud Console.
  CLIENT_ID: 'SEU_CLIENT_ID.apps.googleusercontent.com',

  // Chave de API criada no Google Cloud Console (usada para chamadas públicas do Calendar/Sheets).
  API_KEY: 'SUA_API_KEY',

  // ID da planilha do Google Sheets onde as atas (decisões) serão registradas.
  // É o trecho entre /d/ e /edit na URL da planilha.
  SPREADSHEET_ID: 'SEU_SPREADSHEET_ID',

  // Nome da aba dentro da planilha onde as atas serão gravadas.
  SHEET_NAME: 'Atas',

  // Calendário usado para agendar as reuniões. 'primary' usa o calendário
  // principal da conta autenticada.
  CALENDAR_ID: 'primary',

  // Escopos OAuth necessários para agendar reuniões (Calendar) e registrar atas (Sheets).
  SCOPES: [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/spreadsheets'
  ].join(' ')
};
