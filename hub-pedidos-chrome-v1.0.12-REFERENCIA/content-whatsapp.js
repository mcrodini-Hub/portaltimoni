// Content script para WhatsApp Web

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'buscarFornecedor') {
    buscarFornecedor(request.nome, request.etiqueta).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
  
  if (request.action === 'enviarMensagem') {
    enviarMensagem(request.mensagem).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
});

async function buscarFornecedor(nome, etiqueta) {
  try {
    // Esperar WhatsApp Web carregar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Procurar barra de busca
    let searchInput = document.querySelector('input[aria-label*="Search"]') ||
                      document.querySelector('input[placeholder*="Search"]') ||
                      document.querySelector('[aria-label*="search"]');
    
    if (!searchInput) {
      // Procurar campo de busca por role
      const inputs = document.querySelectorAll('input[type="text"]');
      for (let input of inputs) {
        if (input.getAttribute('aria-label')?.toLowerCase().includes('search')) {
          searchInput = input;
          break;
        }
      }
    }
    
    if (!searchInput) {
      throw new Error('Campo de busca não encontrado no WhatsApp Web');
    }
    
    // Digitar nome do fornecedor
    searchInput.click();
    await new Promise(resolve => setTimeout(resolve, 300));
    searchInput.value = '';
    
    // Tentar buscar pela etiqueta primeiro (se existir)
    const searchTerm = etiqueta || nome;
    
    for (let char of searchTerm) {
      searchInput.value += char;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Aguardar resultados da busca
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Procurar o chat nos resultados
    let chatItem = null;
    
    // Procurar por título de chat
    const chats = document.querySelectorAll('[data-testid="list-item"], [role="option"]');
    
    for (let chat of chats) {
      const textoChat = chat.textContent.toLowerCase();
      
      if (textoChat.includes(nome.toLowerCase()) || 
          textoChat.includes(etiqueta?.toLowerCase() || '')) {
        chatItem = chat;
        break;
      }
    }
    
    if (!chatItem) {
      throw new Error(`Fornecedor "${nome}" não encontrado no WhatsApp. Confirme a busca manualmente.`);
    }
    
    // Clicar no chat
    chatItem.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return { success: true, mensagem: `Aberto chat com ${nome}` };
    
  } catch (erro) {
    throw new Error(`Erro ao buscar fornecedor: ${erro.message}`);
  }
}

async function enviarMensagem(mensagem) {
  try {
    // Procurar campo de mensagem
    let msgInput = document.querySelector('[data-testid="message-pane-footer"] [contenteditable="true"]') ||
                   document.querySelector('[aria-label*="Message"]') ||
                   document.querySelector('[title*="message"]');
    
    if (!msgInput) {
      // Procurar pelo role
      const editables = document.querySelectorAll('[contenteditable="true"]');
      for (let el of editables) {
        if (el.getAttribute('aria-label')?.toLowerCase().includes('message') ||
            el.parentElement?.textContent?.toLowerCase().includes('message')) {
          msgInput = el;
          break;
        }
      }
    }
    
    if (!msgInput) {
      throw new Error('Campo de mensagem não encontrado');
    }
    
    // Clicar e digitar mensagem
    msgInput.click();
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Limpar campo
    msgInput.textContent = '';
    
    // Digitar mensagem
    for (let char of mensagem) {
      msgInput.textContent += char;
      msgInput.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    msgInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    return { 
      success: true, 
      mensagem: 'Mensagem preenchida. Clique em enviar no WhatsApp e volte aqui.' 
    };
    
  } catch (erro) {
    throw new Error(`Erro ao enviar mensagem: ${erro.message}`);
  }
}
