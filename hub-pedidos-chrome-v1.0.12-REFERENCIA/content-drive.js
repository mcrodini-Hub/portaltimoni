// Content script para Google Drive e Google Sheets

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extrairPlanilha') {
    extrairPlanilha(request.fornecedor).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
});

async function extrairPlanilha(fornecedor) {
  try {
    // Esperar página carregar
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Se estamos no Google Drive, precisamos buscar e abrir a planilha
    if (window.location.href.includes('/drive/') && !window.location.href.includes('/spreadsheets/')) {
      // Estamos no Drive, procurar arquivo
      await abrirPlanilhaDrive(fornecedor);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Agora extrair dados da planilha
    const dados = await extrairDadosPlanilha(fornecedor);
    return dados;
    
  } catch (erro) {
    throw new Error(`Erro ao extrair planilha: ${erro.message}`);
  }
}

async function abrirPlanilhaDrive(fornecedor) {
  // Procurar pelo nome do fornecedor nos arquivos do Drive
  const nomeArquivo = `${fornecedor}.xlsx`;
  
  // Buscar links de arquivo
  const arquivos = document.querySelectorAll('[data-name]');
  
  for (let arquivo of arquivos) {
    const nome = arquivo.getAttribute('data-name') || arquivo.textContent;
    
    if (nome.includes(fornecedor) && (nome.includes('.xlsx') || nome.includes('.xls') || nome.includes('Sheets'))) {
      // Encontrou o arquivo
      const link = arquivo.querySelector('a') || arquivo.parentElement.querySelector('a');
      if (link) {
        link.click();
        return;
      }
    }
  }
  
  throw new Error(`Arquivo não encontrado para ${fornecedor}`);
}

async function extrairDadosPlanilha(fornecedor) {
  // Detectar se é Google Sheets
  if (!window.location.href.includes('docs.google.com/spreadsheets')) {
    throw new Error('Por favor, abra a planilha do fornecedor no Google Sheets');
  }
  
  // Aguardar Sheets carregar
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    // Tentar usar Google Sheets API via injeção de script
    const dados = await executarEmContextoPagina(() => {
      // Este código roda no contexto da página
      
      // Encontrar a tabela de dados
      const linhas = [];
      const cells = document.querySelectorAll('[role="gridcell"]');
      
      // Agrupar células por linha
      const linhasMap = {};
      cells.forEach(cell => {
        const row = cell.getAttribute('aria-rowindex') || cell.parentElement?.rowIndex || 0;
        if (!linhasMap[row]) linhasMap[row] = [];
        linhasMap[row].push(cell.textContent);
      });
      
      // Converter para array
      const linhasArray = Object.values(linhasMap);
      
      if (linhasArray.length < 4) {
        throw new Error('Planilha vazia ou formato incorreto');
      }
      
      // Encontrar colunas: Código (B), Descrição (D), Mês Corrente
      // Assumindo: linha 1 = headers
      const headers = linhasArray[0] || [];
      const mesCurrentIdx = headers.findIndex(h => {
        const mes = new Date();
        const mesAtual = mes.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();
        return h.includes(mesAtual) || h.includes('JUL') || h.includes(mes.getFullYear().toString());
      });
      
      // Colunas padrão (índices 0-based)
      const idxCodigo = 1; // Coluna B
      const idxDescricao = 3; // Coluna D
      const idxMes = mesCurrentIdx > 0 ? mesCurrentIdx : 7; // Padrão: coluna H/I
      
      // Extrair primeira linha com dados (linha 4)
      let codigo = '';
      let descricao = '';
      let quantidade = '';
      
      for (let i = 3; i < linhasArray.length; i++) {
        const linha = linhasArray[i];
        if (linha.length > 0 && linha[0] !== '') {
          codigo = linha[idxCodigo] || '';
          descricao = linha[idxDescricao] || '';
          quantidade = linha[idxMes] || '';
          
          // Ignorar linhas vazias na quantidade
          if (codigo && descricao) {
            break;
          }
        }
      }
      
      return {
        codigo: codigo.trim(),
        descricao: descricao.trim(),
        quantidade: quantidade.trim()
      };
    });
    
    return dados;
    
  } catch (erro) {
    // Fallback: tentar extração manual
    console.log('Fallback para extração manual...');
    
    const tableRows = document.querySelectorAll('tr');
    if (tableRows.length < 4) {
      throw new Error('Não conseguiu extrair dados da planilha');
    }
    
    // Procurar primeira linha com dados
    let codigo = '';
    let descricao = '';
    let quantidade = '';
    
    for (let i = 3; i < Math.min(tableRows.length, 10); i++) {
      const cells = tableRows[i].querySelectorAll('td, [role="gridcell"]');
      
      if (cells.length >= 4) {
        const codigoCell = cells[1]?.textContent.trim();
        const descCell = cells[3]?.textContent.trim();
        
        if (codigoCell && descCell) {
          codigo = codigoCell;
          descricao = descCell;
          
          // Procurar quantidade (última coluna com dados)
          for (let j = cells.length - 1; j >= 0; j--) {
            const val = cells[j]?.textContent.trim();
            if (val && !isNaN(val) && val !== '0') {
              quantidade = val;
              break;
            }
          }
          
          break;
        }
      }
    }
    
    if (!codigo || !descricao) {
      throw new Error('Não conseguiu encontrar os dados esperados na planilha');
    }
    
    return {
      codigo,
      descricao,
      quantidade
    };
  }
}

// Helper para executar código no contexto da página
async function executarEmContextoPagina(func) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.textContent = `
      try {
        const resultado = (${func.toString()})();
        window.__sheetData = resultado;
      } catch (e) {
        window.__sheetError = e.message;
      }
    `;
    document.head.appendChild(script);
    
    setTimeout(() => {
      if (window.__sheetError) {
        reject(new Error(window.__sheetError));
      } else if (window.__sheetData) {
        resolve(window.__sheetData);
      } else {
        reject(new Error('Timeout ao extrair dados'));
      }
      delete window.__sheetData;
      delete window.__sheetError;
      script.remove();
    }, 1000);
  });
}
