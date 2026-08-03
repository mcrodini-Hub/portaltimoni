// Remove a confirmação intermediária e atualiza o Trello diretamente.
(() => {
  const button = document.getElementById('btn-atualizar-trello');
  const confirmWrap = document.getElementById('confirm-wrap');

  if (confirmWrap) {
    confirmWrap.hidden = true;
    confirmWrap.style.display = 'none';
  }

  if (!button) return;

  button.addEventListener(
    'click',
    async (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = 'Atualizando Trello...';

      try {
        const result = await HubMessages.send(
          HubMessages.TYPES.UPDATE_TRELLO,
          null,
          'sidebar',
        );

        if (result?.error) {
          await HubState.setState({
            lastError: result.error,
            currentState: HubState.STATES.ERRO,
          });
        }
      } catch (error) {
        await HubState.setState({
          lastError: error instanceof Error ? error.message : 'Não foi possível atualizar o Trello.',
          currentState: HubState.STATES.ERRO,
        });
      } finally {
        button.textContent = originalText;
        const state = await HubState.getState();
        button.disabled = !(
          state.selectedSupplier &&
          Array.isArray(state.extractedItems) &&
          state.extractedItems.length > 0
        );
      }
    },
    true,
  );
})();
