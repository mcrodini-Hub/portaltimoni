const { TYPES, makeMessage } = MarketingCTMessages;

const pinBtn = document.getElementById('pinBtn');
const resetBtn = document.getElementById('resetBtn');

async function refresh() {
  const response = await chrome.runtime.sendMessage(makeMessage(TYPES.GET_STATE, null, 'sidebar'));
  render(response.payload);
}

function render(state) {
  pinBtn.textContent = state.pinned ? 'Desafixar' : 'Fixar';
}

pinBtn.addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage(makeMessage(TYPES.TOGGLE_PIN, null, 'sidebar'));
  render(response.payload);
});

resetBtn.addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage(makeMessage(TYPES.RESET_MODULE, null, 'sidebar'));
  render(response.payload);
});

refresh();
