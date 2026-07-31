// Perfis e permissões finais do módulo Estoque.
(function () {
  const tela = document.getElementById('tela-papel');
  const card = tela ? tela.querySelector('.role-card') : null;
  const trocarWrap = document.getElementById('trocar-perfil-wrap');
  const trocarBotao = document.getElementById('btn-trocar-perfil');

  const grupos = [
    {
      titulo: 'Vendedores',
      classeTitulo: 'g-vendedores',
      classeBotao: 'role-vendedores',
      perfis: [
        { nome: 'Rio Claro', papel: 'balcao', unidade: 'rio_claro', pessoa: 'vendedores_rio_claro' },
        { nome: 'Araras', papel: 'balcao', unidade: 'araras', pessoa: 'vendedores_araras' }
      ]
    },
    {
      titulo: 'Estoque',
      classeTitulo: 'g-estoque',
      classeBotao: 'role-estoque',
      perfis: [
        { nome: 'Lucas Rio Claro', papel: 'estoque', unidade: 'rio_claro', pessoa: 'lucas_rio_claro' },
        { nome: 'Lucas Araras', papel: 'estoque', unidade: 'araras', pessoa: 'lucas_araras' },
        { nome: 'Jeovana', papel: 'estoque', unidade: 'todas', pessoa: 'jeovana' },
        { nome: 'Reinaldo', papel: 'estoque', unidade: 'todas', pessoa: 'reinaldo' }
      ]
    },
    {
      titulo: 'Gestão',
      classeTitulo: 'g-gestao',
      classeBotao: 'role-gestao',
      perfis: [
        { nome: 'Ciça', papel: 'acompanhamento', unidade: 'todas', pessoa: 'cica' },
        { nome: 'Marcelo', papel: 'acompanhamento', unidade: 'todas', pessoa: 'marcelo' }
      ]
    }
  ];

  function manterTrocaVisivel() {
    if (trocarWrap) trocarWrap.hidden = false;
  }

  async function escolherPerfil(perfil) {
    await EstoqueStore.setRole(perfil.papel);
    await EstoqueStore.setUnidade(perfil.unidade);
    await EstoqueStore.setPessoa(perfil.pessoa);
    location.reload();
  }

  function montarTelaPerfis() {
    if (!card) return;

    card.querySelectorAll('.role-group, .js-papel').forEach((node) => node.remove());

    grupos.forEach((grupo) => {
      const titulo = document.createElement('p');
      titulo.className = `role-group ${grupo.classeTitulo}`;
      titulo.textContent = grupo.titulo;
      card.appendChild(titulo);

      grupo.perfis.forEach((perfil) => {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = `btn role-btn ${grupo.classeBotao} js-papel`;
        botao.textContent = perfil.nome;
        botao.addEventListener('click', () => escolherPerfil(perfil));
        card.appendChild(botao);
      });
    });
  }

  montarTelaPerfis();
  manterTrocaVisivel();

  const observer = new MutationObserver(manterTrocaVisivel);
  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden']
  });

  if (trocarBotao) {
    trocarBotao.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (!confirm('Trocar o perfil deste computador?')) return;

      chrome.storage.local.remove(
        ['estoqueRole', 'estoqueUnidade', 'estoquePessoa'],
        () => location.reload()
      );
    }, true);
  }
})();
