// Content script para Trello

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'listarFornecedores') {
    listarFornecedores().then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true; // Indica que a resposta é assíncrona
  }
  
  if (request.action === 'atualizarCard') {
    atualizarCard(request).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
});

async function listarFornecedores() {
  try {
    // Esperar a página carregar
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Buscar cards da lista "RELAÇÃO E PEDIDOS RIO CLARO / ARARAS"
    const fornecedores = [];
    
    // Procurar pela lista - múltiplas estratégias
    // Estratégia 1: Por data-testid
    let listElement = null;
    
    const lists = document.querySelectorAll('[data-testid="list"]');
    for (let list of lists) {
      const listTitle = list.textContent || '';
      if (listTitle.includes('RELAÇÃO') && (listTitle.includes('RIO CLARO') || listTitle.includes('ARARAS'))) {
        listElement = list;
        break;
      }
    }
    
    // Estratégia 2: Procurar por classe/role
    if (!listElement) {
      const allLists = document.querySelectorAll('[role="main"] > div, [role="region"]');
      for (let list of allLists) {
        if (list.textContent.includes('RELAÇÃO') && list.textContent.includes('RIO CLARO')) {
          listElement = list;
          break;
        }
      }
    }
    
    // Se encontrou a lista, extrair cards
    if (listElement) {
      const cards = listElement.querySelectorAll('[data-testid="trello-card"], [draggable="true"]');
      
      if (!cards || cards.length === 0) {
        // Tentar estratégia alternativa
        const cardElements = listElement.querySelectorAll('a[href*="/c/"], [role="button"]');
        
        cardElements.forEach((card, idx) => {
          const nome = card.textContent?.trim() || card.innerText?.trim() || `Fornecedor ${idx}`;
          
          if (nome && nome.length > 0 && !nome.includes('List') && !nome.includes('Add')) {
            fornecedores.push({
              nome: nome.substring(0, 100), // Limitar tamanho
              cardId: card.getAttribute('href') || `card-${idx}`,
              tags: [],
              element: card
            });
          }
        });
      } else {
        // Usar cards encontrados
        cards.forEach((card, idx) => {
          const nome = card.querySelector('[data-testid="card-name"]')?.textContent ||
                      card.textContent?.split('\n')[0]?.trim() ||
                      `Fornecedor ${idx}`;
          const cardId = card.getAttribute('data-testid') || card.id || `card-${idx}`;
          
          fornecedores.push({
            nome: nome.trim().substring(0, 100),
            cardId: cardId,
            tags: [],
            element: card
          });
        });
      }
    }
    
    // Fallback: se não encontrou lista específica, pega todos os cards
    if (!fornecedores || fornecedores.length === 0) {
      const allCards = document.querySelectorAll('[data-testid="trello-card"]');
      
      if (allCards && allCards.length > 0) {
        allCards.forEach((card, idx) => {
          const nome = card.textContent?.trim()?.substring(0, 100) || `Card ${idx}`;
          
          // Extrair etiquetas do card
          const badges = card.querySelectorAll('[data-testid="cardBadge"], .Badge, [class*="label"]');
          const tags = [];
          badges.forEach(badge => {
            const label = badge.textContent?.trim();
            if (label) tags.push(label);
          });
          
          fornecedores.push({
            nome: nome,
            cardId: card.id || `card-${idx}`,
            tags: tags,
            element: card
          });
        });
      }
    }
    
    // ✅ FILTRO: Apenas fornecedores com etiqueta "Rio Claro" (verde)
    const fornecedoresRioClar = fornecedores.filter(f => {
      // Procurar por "Rio Claro" nas tags ou no nome
      const temRioClar = f.tags.some(tag => tag.toLowerCase().includes('rio claro')) ||
                        f.nome.toLowerCase().includes('rio claro');
      return temRioClar;
    });
    
    // Se não encontrou com filtro, retornar todos
    const fornecedoresFinais = fornecedoresRioClar.length > 0 ? fornecedoresRioClar : fornecedores;
    
    if (!fornecedoresFinais || fornecedoresFinais.length === 0) {
      return { 
        fornecedores: [{
          nome: '(Nenhum fornecedor encontrado - verifique o Trello)',
          cardId: 'manual',
          tags: []
        }],
        aviso: 'Nenhum fornecedor detectado automaticamente'
      };
    }
    
    return { fornecedores: fornecedoresFinais };
    
  } catch (erro) {
    console.error('Erro completo:', erro);
    return { 
      fornecedores: [{
        nome: `Erro: ${erro.message}`,
        cardId: 'erro',
        tags: []
      }],
      erro: erro.message
    };
  }
}

async function atualizarCard(request) {
  try {
    const { cardId, descricao, dataPedido, dataEntrega, numPedido, printImagem } = request;
    
    // Encontrar e clicar no card
    const cards = document.querySelectorAll('[data-testid="trello-card"]');
    let targetCard = null;
    
    for (let card of cards) {
      if (card.getAttribute('data-testid').includes(cardId) || card.id === cardId) {
        targetCard = card;
        break;
      }
    }
    
    if (!targetCard) {
      // Tentar por texto do card
      for (let card of cards) {
        if (card.textContent.includes(numPedido)) {
          targetCard = card;
          break;
        }
      }
    }
    
    if (!targetCard) {
      throw new Error('Card não encontrado');
    }
    
    // Clicar no card para abrir
    targetCard.click();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Atualizar descrição
    const descField = document.querySelector('[data-testid="card-details"] textarea[name="description"]') ||
                      document.querySelector('[data-testid="card-details"] [role="textbox"]');
    
    if (descField) {
      descField.click();
      await new Promise(resolve => setTimeout(resolve, 200));
      descField.value = descricao;
      descField.dispatchEvent(new Event('input', { bubbles: true }));
      descField.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    // Atualizar datas (se houver campo de data)
    const dateInputs = document.querySelectorAll('[data-testid="card-details"] input[type="text"]');
    
    // Tentar encontrar campo de data por label
    for (let input of dateInputs) {
      const label = input.previousElementSibling?.textContent || input.parentElement?.textContent || '';
      
      if (label.includes('Data') || label.includes('Prazo')) {
        if (label.includes('Pedido') || label.includes('de')) {
          input.value = dataPedido;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (label.includes('Entrega')) {
          input.value = dataEntrega;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }
    
    // Atualizar etiqueta "Pedido Enviado"
    const labelButtons = document.querySelectorAll('[data-testid="card-label-button"], [role="button"][aria-label*="label"]');
    
    for (let btn of labelButtons) {
      if (btn.textContent.includes('Pedido Enviado')) {
        // Já tem, não precisa adicionar
        break;
      }
    }
    
    // Anexar print (se fornecido)
    if (printImagem) {
      // Procurar botão de adicionar anexo
      const attachBtn = document.querySelector('[data-testid="attachments-section"] button') ||
                        document.querySelector('button[aria-label*="Attach"]');
      
      if (attachBtn) {
        attachBtn.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Criar um blob da imagem
        const dataArr = printImagem.split(',');
        const mimeMatch = dataArr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/png';
        const bstr = atob(dataArr[1]);
        const n = bstr.length;
        const u8arr = new Uint8Array(n);
        
        for (let i = 0; i < n; i++) {
          u8arr[i] = bstr.charCodeAt(i);
        }
        
        const blob = new Blob([u8arr], { type: mime });
        const file = new File([blob], `Pedido-${numPedido}.png`, { type: mime });
        
        // Simular upload
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          fileInput.files = dataTransfer.files;
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
    
    // Salvar/fechar
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Procurar botão de fechar ou salvar
    const closeBtn = document.querySelector('[data-testid="popover-close"], button[aria-label="Close"]');
    if (closeBtn) closeBtn.click();
    
    return { success: true };
    
  } catch (erro) {
    throw new Error(`Erro ao atualizar card: ${erro.message}`);
  }
}
