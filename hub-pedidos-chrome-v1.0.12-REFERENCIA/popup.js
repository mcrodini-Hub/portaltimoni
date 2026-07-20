// Estado global
const state = {
  etapaAtual: 'inicio', // inicio → listar → extrair → bessani → trello → whatsapp
  fornecedores: [],
  fornecedorAtual: 0,
  fornecedorSelecionado: null,
  processados: [],
  dadosAtual: {
    codigo: null,
    descricao: null,
    quantidade: null,
    numPedido: null,
    dataPedido: null,
    dataEntrega: null,
    printImagem: null
  },
  trelloCardId: null,
  whatsappLink: null
};

// ============================================================================
// COMUNICAÇÃO COM SIDEBAR
// ============================================================================

// Listener para mensagens da sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'iniciar-automacao-sidebar') {
    console.log('📲 Recebido comando de iniciar da sidebar');
    // Simular clique no botão de iniciar
    setTimeout(() => {
      if (elements.btnInit) {
        elements.btnInit.click();
      }
    }, 100);
    sendResponse({ status: 'iniciando' });
  }
});

// Elementos DOM
const elements = {
  etapaInit: document.getElementById('etapa-init'),
  etapaLista: document.getElementById('etapa-lista'),
  etapaDrive: document.getElementById('etapa-drive'),
  etapaBessani: document.getElementById('etapa-bessani'),
  etapatrello: document.getElementById('etapa-trello'),
  etapaWhatsapp: document.getElementById('etapa-whatsapp'),
  etapaFinal: document.getElementById('etapa-final'),
  
  btnInit: document.getElementById('btn-init'),
  btnConfirmaLista: document.getElementById('btn-confirma-lista'),
  btnReset: document.getElementById('btn-reset'),
  btnConfirmaBessani: document.getElementById('btn-confirma-bessani'),
  btnVoltaDrive: document.getElementById('btn-volta-drive'),
  btnAbrirWhatsapp: document.getElementById('btn-abrir-whatsapp'),
  btnProximoFornecedor: document.getElementById('btn-proximo-fornecedor'),
  btnVoltaTrello: document.getElementById('btn-volta-trello'),
  btnNovaRodada: document.getElementById('btn-nova-rodada'),
  
  fornecedorLista: document.getElementById('fornecedor-lista'),
  fornecedorAtualSpan: document.getElementById('fornecedor-atual'),
  uploadPrint: document.getElementById('upload-print'),
  previewPrint: document.getElementById('preview-print'),
  previewImg: document.getElementById('preview-img'),
  inputNumPedido: document.getElementById('input-num-pedido'),
  inputDataPedido: document.getElementById('input-data-pedido'),
  inputDataEntrega: document.getElementById('input-data-entrega'),
  textareaWhatsapp: document.getElementById('textarea-whatsapp'),
  dataCodigo: document.getElementById('data-codigo'),
  dataDescricao: document.getElementById('data-descricao'),
  dataQuantidade: document.getElementById('data-quantidade')
};

// ============================================================================
// COMUNICAÇÃO COM SIDEBAR
// ============================================================================

async function enviarParaSidebar(data) {
  try {
    // Adicionar dados padrão
    data.progresso = state.fornecedorAtual;
    data.total = state.fornecedores.length;
    data.processados = state.processados;
    data.fornecedores = state.fornecedores.map(f => ({ nome: f.nome }));
    
    // Enviar para todas as abas da sidebar
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      try {
        chrome.tabs.sendMessage(tab.id, {
          action: 'sidebar-update',
          data: data
        }).catch(() => {
          // Silenciosamente ignorar erros de abas que não têm a sidebar
        });
      } catch (e) {
        // Ignorar erros
      }
    });
    
    // Também tentar via service worker
    chrome.runtime.sendMessage({
      action: 'sidebar-update',
      data: data
    }).catch(() => {});
  } catch (e) {
    console.error('Erro ao enviar para sidebar:', e);
  }
}

// ============================================================================
// FUNÇÕES DE ABERTURA DE ABAS
// ============================================================================

async function criarAbaRobusta(url, nome) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`[CRIAR ABA] Iniciando: ${nome} - URL: ${url}`);
      
      chrome.tabs.create({ 
        url: url,
        active: false 
      }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error(`[ERRO TAB] ${nome} - LastError:`, chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!tab) {
          console.error(`[ERRO TAB] ${nome} - Tab é nulo`);
          reject(new Error(`Tab não foi criada para ${nome}`));
          return;
        }
        
        console.log(`[✅ ABA] ${nome} criada com sucesso - Tab ID: ${tab.id}`);
        
        // Aguardar aba carregar
        const checkInterval = setInterval(() => {
          chrome.tabs.get(tab.id, (tabCheck) => {
            if (chrome.runtime.lastError) {
              clearInterval(checkInterval);
              console.error(`[ERRO CHECK] ${nome}:`, chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
              return;
            }
            
            if (tabCheck && tabCheck.status === 'complete') {
              clearInterval(checkInterval);
              console.log(`[CARREGADA] ${nome} carregada completamente`);
              resolve(tab);
            } else {
              console.log(`[CARREGANDO] ${nome} - Status: ${tabCheck?.status}`);
            }
          });
        }, 500);
        
        // Timeout de 5s (otimizado)
        setTimeout(() => {
          clearInterval(checkInterval);
          console.warn(`[TIMEOUT] ${nome} não carregou em 5s, mas resolvendo...`);
          resolve(tab);
        }, 5000);
      });
    } catch (e) {
      console.error(`[EXCEÇÃO] ${nome}:`, e.message);
      reject(e);
    }
  });
}

// ============================================================================
// FUNÇÕES DE SIDEBAR (ACOMPANHAMENTO)
// ============================================================================

function abrirSidebar() {
  try {
    chrome.sidePanel.open({ tabId: chrome.tabs.TAB_ID_NONE });
  } catch (e) {
    console.log('Sidebar já aberta ou indisponível');
  }
}

async function enviarParaSidebar(data) {
  try {
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      try {
        chrome.tabs.sendMessage(tab.id, {
          action: 'sidebar-update',
          data: data
        }).catch(() => {
          // Silenciar erros de abas sem conteúdo
        });
      } catch (e) {
        // Silenciar
      }
    });
  } catch (e) {
    console.error('Erro ao enviar para sidebar:', e);
  }
}

function atualizarSidebarProgresso() {
  enviarParaSidebar({
    progresso: state.fornecedorAtual + 1,
    total: state.fornecedores.length,
    processados: state.processados,
    statusGeral: `${state.fornecedorAtual + 1}/${state.fornecedores.length} fornecedores`
  });
}

function atualizarSidebarFornecedor(nome) {
  enviarParaSidebar({
    fornecedorAtual: nome,
    log: {
      mensagem: `🎯 Iniciando processamento: ${nome}`,
      tipo: 'info'
    }
  });
}

function atualizarSidebarEtapa(etapa, descricao = '') {
  enviarParaSidebar({
    etapaAtual: etapa,
    log: {
      mensagem: descricao || etapa,
      tipo: 'info'
    }
  });
}

function adicionarLogSidebar(mensagem, tipo = 'info') {
  enviarParaSidebar({
    log: {
      mensagem: mensagem,
      tipo: tipo
    }
  });
}

function atualizarSidebarPausa(pausado) {
  enviarParaSidebar({
    pausado: pausado,
    statusGeral: pausado ? '⏸️ PAUSADO' : '▶️ Processando'
  });
}

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

elements.btnInit.addEventListener('click', async () => {
  elements.btnInit.disabled = true;
  const status = document.getElementById('init-status');
  status.style.display = 'block';
  status.innerHTML = '<div class="status-box"><span class="loading"></span> Abrindo abas: Trello...</div>';
  
  try {
    // Abrir sidebar
    abrirSidebar();
    
    console.log('🎯 Hub iniciado! As 3 abas devem estar abertas.');
    console.log('   📱 WhatsApp Web');
    console.log('   📋 Trello');
    console.log('   📊 Google Drive');
    
    status.innerHTML = '<div class="status-box active">✅ Iniciando com abas já abertas!</div>';
    
    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Ir direto para listar fornecedores do Trello
    
    // Listar fornecedores do Trello
    console.log('🔍 Buscando fornecedores no Trello...');
    status.innerHTML = '<div class="status-box"><span class="loading"></span> Listando fornecedores do Trello...</div>';
    
    // Procurar abas do Trello já abertas
    console.log('🔍 Procurando abas do Trello...');
    const tabs_result = await chrome.tabs.query({ url: 'https://trello.com/*' });
    
    console.log(`Encontradas ${tabs_result.length} aba(s) do Trello`);
    
    // Se não encontrou, assumir que está lá e tentar mesmo assim
    if (tabs_result.length === 0) {
      console.warn('⚠️ Nenhuma aba do Trello encontrada pela query, mas continuando...');
      adicionarLogSidebar('⚠️ Verificando Trello...', 'warning');
    }
    
    try {
      // Se tem abas, usar a primeira. Se não, será null mas continuaremos
      const trelloTab = tabs_result.length > 0 ? tabs_result[0] : null;
      
      if (!trelloTab) {
        console.log('ℹ️ Sem aba do Trello encontrada, pulando Etapa 1');
        adicionarLogSidebar('ℹ️ Etapa 1 ignorada', 'info');
        // Pular para próxima etapa
        return;
      }
      
      const result = await chrome.tabs.sendMessage(trelloTab.id, {
        action: 'listarFornecedores'
      });
      
      state.fornecedores = result?.fornecedores || [];
      
      if (!state.fornecedores || state.fornecedores.length === 0) {
        status.innerHTML = '<div class="status-box warning">⚠️ Nenhum fornecedor encontrado. Verifique Trello.</div>';
        elements.btnInit.disabled = false;
        return;
      }
      
      status.innerHTML = `<div class="status-box active">✅ ${state.fornecedores.length} fornecedores encontrados!</div>`;
      
      // Atualizar sidebar
      enviarParaSidebar({
        statusGeral: `${state.fornecedores.length} fornecedores encontrados`,
        total: state.fornecedores.length,
        fornecedores: state.fornecedores,
        progresso: 0,
        processados: [],
        log: { mensagem: `✅ Listagem completa: ${state.fornecedores.length} fornecedores`, tipo: 'success' }
      });
    } catch (erro) {
      console.error('Erro ao comunicar com Trello:', erro);
      status.innerHTML = `<div class="status-box warning">⚠️ Erro: ${erro.message}</div>`;
      enviarParaSidebar({
        statusGeral: 'Erro ao listar fornecedores',
        log: { mensagem: `Erro: ${erro.message}`, tipo: 'error' }
      });
      elements.btnInit.disabled = false;
      return;
    }
    
    // Mostrar próxima etapa
    setTimeout(() => {
      elements.etapaInit.style.display = 'none';
      elements.etapaLista.style.display = 'block';
      mostrarLista();
      // Garantir focus na extensão
      window.focus();
      
      // Mostrar alerta amigável
      const msg = `✅ ${state.fornecedores.length} fornecedores encontrados!\n\nClique em "Começar Processamento" para iniciar.`;
      console.log(msg);
    }, 1500);
    
  } catch (erro) {
    status.innerHTML = `<div class="status-box error">❌ Erro: ${erro.message}</div>`;
    elements.btnInit.disabled = false;
  }
});

function mostrarLista() {
  const countSpan = document.getElementById('count-fornecedores');
  if (countSpan) {
    countSpan.textContent = state.fornecedores.length;
  }
  
  elements.fornecedorLista.innerHTML = state.fornecedores.map((f, idx) => `
    <div class="fornecedor-item ${state.processados.includes(idx) ? 'completed' : ''}" data-idx="${idx}">
      <div>
        <strong>${f.nome}</strong>
        <div class="fornecedor-status">
          ${state.processados.includes(idx) ? '✅ Processado' : '⏳ Pendente'}
        </div>
      </div>
      <span>${state.processados.includes(idx) ? '✓' : '→'}</span>
    </div>
  `).join('');
}

elements.btnConfirmaLista.addEventListener('click', () => {
  elements.etapaLista.style.display = 'none';
  state.fornecedorAtual = 0;
  iniciarProcessoFornecedor();
});

elements.btnReset.addEventListener('click', () => {
  location.reload();
});

// ============================================================================
// ETAPA 1: EXTRAÇÃO GOOGLE DRIVE
// ============================================================================

async function iniciarProcessoFornecedor() {
  if (state.fornecedorAtual >= state.fornecedores.length) {
    // Finalizar
    elements.etapaLista.style.display = 'none';
    elements.etapaFinal.style.display = 'block';
    
    // Atualizar sidebar
    enviarParaSidebar({
      statusGeral: '✅ Processo Finalizado!',
      etapaAtual: 'finalizado',
      progresso: state.fornecedores.length,
      log: { mensagem: 'Todos os fornecedores foram processados com sucesso!', tipo: 'success' }
    });
    
    return;
  }
  
  const fornecedor = state.fornecedores[state.fornecedorAtual];
  elements.fornecedorAtualSpan.textContent = fornecedor.nome;
  
  // Atualizar sidebar
  atualizarSidebarProgresso();
  atualizarSidebarFornecedor(fornecedor.nome);
  atualizarSidebarEtapa('extrair-drive', '📊 Extraindo dados do Google Drive...');
  atualizarSidebarPausa(false);
  
  elements.etapaLista.style.display = 'none';
  elements.etapaDrive.style.display = 'block';
  
  try {
    // Executar script no Google Drive
    const tabsDrive = await chrome.tabs.query({ url: 'https://drive.google.com/*' });
    if (tabsDrive.length === 0) throw new Error('Google Drive não encontrado');
    
    const result = await chrome.tabs.sendMessage(tabsDrive[0].id, {
      action: 'extrairPlanilha',
      fornecedor: fornecedor.nome
    });
    
    // Log de sucesso
    adicionarLogSidebar(`✅ Dados extraídos de ${fornecedor.nome}`, 'success');
    
    state.dadosAtual.codigo = result.codigo;
    state.dadosAtual.descricao = result.descricao;
    state.dadosAtual.quantidade = result.quantidade;
    state.dadosAtual.trelloCardId = fornecedor.cardId;
    
    // Mostrar resultados
    elements.dataCodigo.textContent = state.dadosAtual.codigo || '--';
    elements.dataDescricao.textContent = state.dadosAtual.descricao || '--';
    
    // Atualizar sidebar com pausa
    atualizarSidebarEtapa('receber-bessani', '🖼️ Aguardando dados do Bessani...');
    atualizarSidebarPausa(true);
    adicionarLogSidebar(`⏸️ PAUSADO: Revise dados e envie print do Bessani`, 'warning');
    elements.dataQuantidade.textContent = state.dadosAtual.quantidade || '--';
    
    document.getElementById('drive-resultado').style.display = 'block';
    document.getElementById('drive-status').style.display = 'none';
    
    // Próxima etapa após 2s
    setTimeout(() => {
      elements.etapaDrive.style.display = 'none';
      elements.etapaBessani.style.display = 'block';
    }, 2000);
    
  } catch (erro) {
    document.getElementById('drive-status').innerHTML = `<div class="status-box error">❌ Erro: ${erro.message}</div>`;
  }
}

// ============================================================================
// ETAPA 2: PRINT BESSANI
// ============================================================================

elements.uploadPrint.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      state.dadosAtual.printImagem = event.target.result;
      elements.previewImg.src = event.target.result;
      elements.previewPrint.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
});

// Suportar paste de imagem
document.addEventListener('paste', (e) => {
  try {
    const items = e.clipboardData?.items || e.clipboardData?.files;
    
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Verificar se é imagem
        if (item.type && item.type.indexOf('image') !== -1) {
          e.preventDefault();
          
          let blob;
          if (item.getAsFile) {
            blob = item.getAsFile();
          } else {
            blob = item;
          }
          
          const reader = new FileReader();
          reader.onerror = () => {
            alert('Erro ao ler imagem. Tente novamente.');
          };
          reader.onload = (event) => {
            try {
              state.dadosAtual.printImagem = event.target.result;
              elements.previewImg.src = event.target.result;
              elements.previewPrint.style.display = 'block';
              alert('✅ Imagem colada com sucesso!');
            } catch (err) {
              alert('Erro ao processar imagem: ' + err.message);
            }
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
    }
  } catch (erro) {
    console.error('Erro no paste:', erro);
    alert('Erro: ' + erro.message);
  }
});

elements.btnConfirmaBessani.addEventListener('click', () => {
  state.dadosAtual.numPedido = elements.inputNumPedido.value;
  state.dadosAtual.dataPedido = elements.inputDataPedido.value;
  state.dadosAtual.dataEntrega = elements.inputDataEntrega.value;
  
  if (!state.dadosAtual.numPedido || !state.dadosAtual.dataPedido || !state.dadosAtual.dataEntrega) {
    alert('Preencha todos os campos!');
    return;
  }
  
  // Atualizar sidebar
  atualizarSidebarEtapa('atualizar-trello', '📋 Atualizando Trello...');
  atualizarSidebarPausa(false);
  adicionarLogSidebar(`✅ Dados do Bessani confirmados. Atualizando Trello...`, 'success');
  
  elements.etapaBessani.style.display = 'none';
  elements.etapatrello.style.display = 'block';
  atualizarTrello();
});

elements.btnVoltaDrive.addEventListener('click', () => {
  elements.etapaBessani.style.display = 'none';
  elements.etapaDrive.style.display = 'block';
});

// ============================================================================
// ETAPA 3: ATUALIZAR TRELLO
// ============================================================================

async function atualizarTrello() {
  try {
    const tabsTrello = await chrome.tabs.query({ url: 'https://trello.com/*' });
    if (tabsTrello.length === 0) throw new Error('Trello não encontrado');
    
    // Montar descrição
    const agora = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const descricao = `Código: ${state.dadosAtual.codigo} | Descrição: ${state.dadosAtual.descricao} | Quantidade: ${state.dadosAtual.quantidade}\n[${agora}]`;
    
    const result = await chrome.tabs.sendMessage(tabsTrello[0].id, {
      action: 'atualizarCard',
      cardId: state.dadosAtual.trelloCardId,
      descricao: descricao,
      dataPedido: state.dadosAtual.dataPedido,
      dataEntrega: state.dadosAtual.dataEntrega,
      numPedido: state.dadosAtual.numPedido,
      printImagem: state.dadosAtual.printImagem
    });
    
    setTimeout(() => {
      document.getElementById('trello-status').style.display = 'none';
      document.getElementById('trello-resultado').style.display = 'block';
      
      // Atualizar sidebar
      adicionarLogSidebar(`✅ Trello atualizado com sucesso`, 'success');
      atualizarSidebarEtapa('preparar-whatsapp', '💬 Preparando mensagem WhatsApp...');
      atualizarSidebarPausa(true);
      
      setTimeout(() => {
        elements.etapatrello.style.display = 'none';
        elements.etapaWhatsapp.style.display = 'block';
      }, 1500);
    }, 2000);
    
  } catch (erro) {
    document.getElementById('trello-status').innerHTML = `<div class="status-box error">❌ Erro: ${erro.message}</div>`;
  }
}

// ============================================================================
// ETAPA 4: WHATSAPP
// ============================================================================

elements.btnAbrirWhatsapp.addEventListener('click', async () => {
  const tabsWhatsapp = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
  if (tabsWhatsapp.length > 0) {
    chrome.tabs.update(tabsWhatsapp[0].id, { active: true });
  } else {
    chrome.tabs.create({ url: 'https://web.whatsapp.com/' });
  }
});

elements.btnProximoFornecedor.addEventListener('click', () => {
  state.processados.push(state.fornecedorAtual);
  
  const fornecedorProcessado = state.fornecedores[state.fornecedorAtual];
  adicionarLogSidebar(`✅ ${fornecedorProcessado.nome} - Processado com sucesso!`, 'success');
  
  state.fornecedorAtual++;
  
  // Atualizar sidebar
  atualizarSidebarProgresso();
  enviarParaSidebar({
    processados: state.processados
  });
  
  // Limpar dados
  state.dadosAtual = {
    codigo: null,
    descricao: null,
    quantidade: null,
    numPedido: null,
    dataPedido: null,
    dataEntrega: null,
    printImagem: null
  };
  
  // Limpar formulários
  elements.inputNumPedido.value = '';
  elements.inputDataPedido.value = '';
  elements.inputDataEntrega.value = '';
  elements.uploadPrint.value = '';
  elements.previewPrint.style.display = 'none';
  
  document.getElementById('drive-status').style.display = 'block';
  document.getElementById('drive-resultado').style.display = 'none';
  document.getElementById('trello-status').style.display = 'block';
  document.getElementById('trello-resultado').style.display = 'none';
  
  elements.etapaWhatsapp.style.display = 'none';
  
  if (state.fornecedorAtual >= state.fornecedores.length) {
    elements.etapaFinal.style.display = 'block';
  } else {
    elements.etapaLista.style.display = 'block';
    mostrarLista();
  }
});

elements.btnVoltaTrello.addEventListener('click', () => {
  elements.etapaWhatsapp.style.display = 'none';
  elements.etapatrello.style.display = 'block';
});

// ============================================================================
// FINALIZAÇÃO
// ============================================================================

elements.btnNovaRodada.addEventListener('click', () => {
  location.reload();
});
