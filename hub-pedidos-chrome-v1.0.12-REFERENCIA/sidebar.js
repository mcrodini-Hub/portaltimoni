// Sidebar - Acompanhamento do processo em tempo real

const sidebar = {
  progresso: 0,
  total: 0,
  fornecedorAtual: '',
  etapaAtual: '',
  fornecedores: [],
  processados: [],
  pausado: false
};

// Elementos DOM
const elements = {
  statusGeral: document.getElementById('status-geral'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  fornecedorAtualBox: document.getElementById('fornecedor-atual-box'),
  fornecedorNumero: document.getElementById('fornecedor-numero'),
  etapaNome: document.getElementById('etapa-nome'),
  etapaDescricao: document.getElementById('etapa-descricao'),
  logContainer: document.getElementById('log-container'),
  listaFornecedores: document.getElementById('lista-fornecedores'),
  statProcessados: document.getElementById('stat-processados'),
  statPendentes: document.getElementById('stat-pendentes'),
  pausedIndicator: document.getElementById('paused-indicator'),
  btnIniciar: document.getElementById('btn-iniciar-sidebar')
};

// Listener do botão INICIAR AUTOMAÇÃO
if (elements.btnIniciar) {
  elements.btnIniciar.addEventListener('click', () => {
    console.log('🚀 Iniciando automação via sidebar...');
    elements.btnIniciar.disabled = true;
    elements.btnIniciar.textContent = '⏳ Iniciando...';
    
    // Enviar mensagem para popup.js
    chrome.runtime.sendMessage({
      action: 'iniciar-automacao-sidebar'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Erro ao iniciar:', chrome.runtime.lastError);
        elements.btnIniciar.disabled = false;
        elements.btnIniciar.innerHTML = '<span class="btn-iniciar-icon">🚀</span>INICIAR AUTOMAÇÃO';
      }
    });
  });
}

// Receber mensagens do popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sidebar-update') {
    atualizarSidebar(request.data);
    sendResponse({ status: 'ok' });
  }
});

function atualizarSidebar(data) {
  if (data.progresso !== undefined) {
    sidebar.progresso = data.progresso;
    atualizarProgresso();
  }
  
  if (data.total !== undefined) {
    sidebar.total = data.total;
    atualizarProgresso();
  }
  
  if (data.fornecedorAtual) {
    sidebar.fornecedorAtual = data.fornecedorAtual;
    atualizarFornecedorAtual();
  }
  
  if (data.etapaAtual) {
    sidebar.etapaAtual = data.etapaAtual;
    atualizarEtapa();
  }
  
  if (data.log) {
    adicionarLogEntry(data.log.mensagem, data.log.tipo || 'info');
  }
  
  if (data.fornecedores) {
    sidebar.fornecedores = data.fornecedores;
    atualizarListaFornecedores();
  }
  
  if (data.processados) {
    sidebar.processados = data.processados;
    atualizarListaFornecedores();
    atualizarEstatisticas();
  }
  
  if (data.statusGeral) {
    elements.statusGeral.textContent = data.statusGeral;
  }
  
  if (data.pausado !== undefined) {
    sidebar.pausado = data.pausado;
    if (data.pausado) {
      elements.pausedIndicator.style.display = 'block';
    } else {
      elements.pausedIndicator.style.display = 'none';
    }
  }
  
  if (data.numero) {
    elements.fornecedorNumero.textContent = `Pedido: ${data.numero}`;
  }
}

function atualizarProgresso() {
  const percentual = sidebar.total > 0 ? (sidebar.progresso / sidebar.total) * 100 : 0;
  elements.progressFill.style.width = percentual + '%';
  elements.progressText.textContent = `${sidebar.progresso} / ${sidebar.total} fornecedores`;
}

function atualizarFornecedorAtual() {
  elements.fornecedorAtualBox.innerHTML = `
    <div class="fornecedor-nome">
      <span class="spinner"></span>${sidebar.fornecedorAtual}
    </div>
    <div class="fornecedor-numero" id="fornecedor-numero">--</div>
  `;
}

function atualizarEtapa() {
  const etapas = {
    'extrair-drive': {
      nome: '📊 Extraindo Google Drive',
      descricao: 'Buscando planilha e extraindo dados...'
    },
    'receber-bessani': {
      nome: '🖼️ Aguardando Print Bessani',
      descricao: 'Esperando você colar o print e preencher dados...'
    },
    'atualizar-trello': {
      nome: '📋 Atualizando Trello',
      descricao: 'Atualizando card com informações...'
    },
    'preparar-whatsapp': {
      nome: '💬 Preparando WhatsApp',
      descricao: 'Gerando mensagem para envio...'
    },
    'enviar-whatsapp': {
      nome: '📱 Enviando WhatsApp',
      descricao: 'Aguardando você enviar a mensagem...'
    },
    'aguardar-resposta': {
      nome: '⏳ Aguardando Resposta',
      descricao: 'Esperando resposta do fornecedor no WhatsApp...'
    },
    'finalizado': {
      nome: '✅ Finalizado',
      descricao: 'Todos os fornecedores foram processados!'
    }
  };
  
  const etapa = etapas[sidebar.etapaAtual] || {
    nome: sidebar.etapaAtual,
    descricao: '--'
  };
  
  elements.etapaNome.textContent = etapa.nome;
  elements.etapaDescricao.textContent = etapa.descricao;
}

function adicionarLogEntry(mensagem, tipo = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${tipo}`;
  
  const timestamp = new Date().toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
  
  const icones = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️'
  };
  
  entry.textContent = `[${timestamp}] ${icones[tipo]} ${mensagem}`;
  elements.logContainer.appendChild(entry);
  
  // Scroll automático para o final
  elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
  
  // Limitar número de entradas (máx 50)
  const entries = elements.logContainer.querySelectorAll('.log-entry');
  if (entries.length > 50) {
    entries[0].remove();
  }
}

function atualizarListaFornecedores() {
  elements.listaFornecedores.innerHTML = '';
  
  if (sidebar.fornecedores.length === 0) {
    elements.listaFornecedores.innerHTML = '<div style="font-size: 11px; color: #666; padding: 8px; text-align: center;">Aguardando lista...</div>';
    return;
  }
  
  sidebar.fornecedores.forEach((fornecedor, idx) => {
    const item = document.createElement('div');
    let classe = 'fornecedor-item';
    let status = '⏳';
    
    if (sidebar.processados.includes(idx)) {
      classe += ' processado';
      status = '✅';
    } else if (sidebar.progresso === idx + 1) {
      classe += ' atual';
      status = '▶️';
    } else if (sidebar.progresso > idx) {
      classe += ' processado';
      status = '✅';
    } else {
      classe += ' pendente';
      status = '⏳';
    }
    
    item.className = classe;
    item.innerHTML = `
      <span class="fornecedor-nome-item">${status} ${fornecedor.nome}</span>
      <span class="fornecedor-status-item"></span>
    `;
    
    elements.listaFornecedores.appendChild(item);
  });
}

function atualizarEstatisticas() {
  elements.statProcessados.textContent = sidebar.processados.length;
  elements.statPendentes.textContent = sidebar.total - sidebar.processados.length;
}

// Inicialização
adicionarLogEntry('Sidebar carregada', 'info');
