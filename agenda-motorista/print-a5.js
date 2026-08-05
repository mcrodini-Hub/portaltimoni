// Impressão A5 da agenda no padrão entregue ao motorista.
(function () {
  function textoSeguro(valor) {
    return String(valor == null ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function dataCabecalho(dataStr) {
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    const data = new Date(ano, mes - 1, dia);
    const semana = ['dom', '2ªf', '3ªf', '4ªf', '5ªf', '6ªf', 'sáb'];
    return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')} - ${semana[data.getDay()]}`;
  }

  function horario(v) {
    if (v.horario && v.horarioFim) return `${v.horario} às ${v.horarioFim}`;
    return v.horario || v.horarioFim || '--:--';
  }

  function endereco(v) {
    let valor = v.endereco || '';
    if (v.numero) valor += `${valor ? ', ' : ''}${v.numero}`;
    if (v.complemento) valor += `${valor ? ' - ' : ''}${v.complemento}`;
    return valor;
  }

  function cabecalhoViagem(v) {
    const partes = [v.clienteFornecedor, v.numeroPedido].filter(Boolean).join(' ');
    if (v.tipoHorario === 'Bloqueio') return v.info || 'BLOQUEIO';
    const volumes = Number(v.volumes || 0);
    const rotuloVolumes = volumes > 0 ? ` (${volumes} ${volumes === 1 ? 'volume' : 'volumes'})` : '';
    return `${partes || v.tipoHorario}${rotuloVolumes}`;
  }

  function bloco(v) {
    const loja = (window.AgendaStore && AgendaStore.LOJA_LABEL && AgendaStore.LOJA_LABEL[v.loja]) || v.loja || '';
    const linhas = [];
    linhas.push(`<div class="titulo">DIA ${textoSeguro(dataCabecalho(v.data || diaAtual))} - ${textoSeguro(cabecalhoViagem(v))}</div>`);

    if (v.tipoHorario === 'Bloqueio') {
      linhas.push(`<div class="linha"><strong>${textoSeguro(horario(v))}:</strong> Bloqueio ${textoSeguro(loja)}</div>`);
    } else {
      linhas.push(`<div class="linha"><strong>${textoSeguro(horario(v))}</strong> - ${textoSeguro(v.tipoHorario || '')} ${textoSeguro(loja)}</div>`);
      linhas.push(`<div class="linha">Contato: ${textoSeguro(v.contatoNome || '')} | Whatsapp: ${textoSeguro(v.contatoWhats || '')}</div>`);
      const end = endereco(v);
      if (end) linhas.push(`<div class="linha">${textoSeguro(end)}</div>`);
      const itens = String(v.itens || '').split('\n').map((x) => x.trim()).filter(Boolean);
      itens.forEach((item) => linhas.push(`<div class="linha">${textoSeguro(item)}</div>`));
    }

    if (v.vendedor) linhas.push(`<div class="linha">Vendedor: ${textoSeguro(v.vendedor)}</div>`);
    if (v.preenchidoPor) linhas.push(`<div class="linha">Preenchido por: ${textoSeguro(v.preenchidoPor)}</div>`);
    return `<section class="viagem">${linhas.join('')}</section>`;
  }

  imprimirRelatorio = function () {
    if (!viagensDia.length) {
      document.getElementById('diaValidationMsg').textContent = 'Não há viagens cadastradas neste dia.';
      return;
    }

    document.getElementById('diaValidationMsg').textContent = '';
    const conteudo = viagensDia.map(bloco).join('');
    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Agenda do Motorista</title>
<style>
  @page { size: A5 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12.5pt; line-height: 1.28; }
  .viagem { break-inside: avoid; page-break-inside: avoid; padding: 0 0 7mm; margin: 0 0 7mm; border-bottom: 1px solid #999; }
  .viagem:last-child { border-bottom: 0; margin-bottom: 0; }
  .titulo { font-size: 13.5pt; font-weight: 700; margin-bottom: 3mm; }
  .linha { margin: 1.2mm 0; }
</style>
</head>
<body>${conteudo}</body>
</html>`;

    const janela = window.open('', '_blank');
    if (!janela) {
      document.getElementById('diaValidationMsg').textContent = 'Permita pop-ups para imprimir o documento.';
      return;
    }
    janela.document.open();
    janela.document.write(html);
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 300);
  };
})();
