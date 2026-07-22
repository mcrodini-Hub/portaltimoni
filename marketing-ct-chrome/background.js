// Service worker do módulo Marketing CT — esqueleto inicial.
// Só abre a sidebar ao clicar no ícone e responde GET_STATE/TOGGLE_PIN.
// Fluxo funcional (campanhas, agendamento, etc.) ainda não foi definido.

importScripts('lib/messages.js', 'lib/state.js');

const { TYPES, makeMessage } = MarketingCTMessages;

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId !== undefined) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case TYPES.GET_STATE: {
      const state = await MarketingCTState.loadState();
      return makeMessage(TYPES.STATE_UPDATED, state, 'background');
    }
    case TYPES.TOGGLE_PIN: {
      const state = await MarketingCTState.loadState();
      state.pinned = !state.pinned;
      await MarketingCTState.saveState(state);
      return makeMessage(TYPES.STATE_UPDATED, state, 'background');
    }
    case TYPES.RESET_MODULE: {
      const state = await MarketingCTState.saveState(MarketingCTState.defaultState());
      return makeMessage(TYPES.STATE_UPDATED, state, 'background');
    }
    default:
      return makeMessage(TYPES.STATE_UPDATED, await MarketingCTState.loadState(), 'background');
  }
}
