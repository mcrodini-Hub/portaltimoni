// Service worker mínimo — por enquanto só garante que o ícone abra o side panel.
// Quando a fonte de dados real (planilha do estoque) for definida, este arquivo passa a
// orquestrar abertura/leitura de aba, no mesmo padrão usado pelo hub-pedidos-chrome
// (ver ../hub-pedidos-chrome/background.js).

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
