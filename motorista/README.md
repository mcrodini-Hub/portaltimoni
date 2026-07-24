# Motorista — Portal Timoni

App de página única (HTML/CSS/JS, sem build) para planejar a agenda real do motorista: calendário do mês, viagens registradas por dia, reorganização de horários, relatório separado por Entregas/Retiradas, rota no Maps e texto pronto para o WhatsApp. Segue a identidade visual do Portal Timoni (azul `#2c4be0`, cabeçalho creme, cards brancos) usada no Hub de Pedidos e no Estoque.

## Como usar

Abra `index.html` direto no navegador (desktop ou celular) — não precisa de instalação. Pode ser aberto como arquivo local ou hospedado como página estática (GitHub Pages, etc.). Na primeira vez, escolhe a loja padrão deste computador (Rio Claro/Araras) — só define o valor inicial do campo "Loja" ao criar uma viagem, não restringe o que você vê.

## Dois modos de dados

Igual ao módulo Estoque:

- **Modo local (padrão)**: sem nada configurado, a agenda fica só no navegador deste computador (localStorage). Bom para testar antes de configurar a planilha, mas não é compartilhado entre computadores/lojas.
- **Modo planilha (real)**: configure a URL de um Web App do Apps Script (⚙ no topo → cole a URL) e a agenda passa a ser compartilhada — qualquer computador de qualquer loja vê e edita a mesma agenda em tempo real.

### Publicar a planilha (uma vez)

1. Crie uma planilha Google nova, com uma aba chamada **"Viagens"** (cabeçalhos e estrutura completa documentados no topo de `apps-script/Codigo.gs`).
2. Na planilha: **Extensões → Apps Script**, apague o conteúdo padrão e cole o conteúdo de `apps-script/Codigo.gs`.
3. Salve. Depois: **Implantar → Nova implantação** → Tipo "App da Web" → Executar como "Eu" → Quem tem acesso "Qualquer pessoa".
4. Copie a URL terminada em `/exec` e cole na página (⚙ → URL do Web App → Salvar e testar).

## Funcionalidades

- **Calendário do mês**: mostra quantas entregas/retiradas cada dia tem, navega entre meses, clique num dia para abrir.
- **Padrão de Araras**: segunda à tarde, quarta e sexta aparecem marcados como "dia padrão de Araras" no calendário e num aviso ao abrir o dia — é só um lembrete visual, não trava nada.
- **Viagens por dia**: cada dia tem sua lista de viagens (Entrega ou Retirada), com botões ▲▼ para reordenar o horário de atendimento.
- **Retirada bloqueando entregas**: ao registrar uma Retirada, informa por quantos minutos ela "segura" a saída de entregas; qualquer entrega cujo horário caia dentro dessa janela aparece com um aviso de conflito no card.
- **Busca de CEP**: consulta a [ViaCEP](https://viacep.com.br/) e preenche logradouro/bairro/cidade.
- **Filtro por loja**: dentro do dia, filtra a visualização por Rio Claro/Araras/Todas (a reordenação só fica disponível em "Todas", pra não embaralhar viagens escondidas pelo filtro).
- **Texto para WhatsApp**: gerado automaticamente a partir das viagens do dia (sempre o dia inteiro, o filtro de loja é só uma lente de visualização).
- **Relatório de impressão**: separado em seções ENTREGAS e RETIRADAS.
- **Excel do dia**: gera um `.xls` (SpreadsheetML) com uma linha por viagem, na ordem da agenda.
- **Rota no Maps**: abre o Google Maps com as paradas do dia em sequência (na ordem da agenda), pronto pro motorista seguir no celular.
- **Preenchido por**: Ciça, Jaqueline, Jeovana, Reginaldo, Thais.
- **Anexos (dividir pedido entre empresas)**: quando uma viagem tem mais de uma nota fiscal, detalha itens por empresa.

## Acessos

Sem restrição por pessoa ou por loja: é um motorista só para as duas lojas (Rio Claro e Araras), então qualquer um dos 5 caixas — Ciça, Jaqueline, Jeovana, Reginaldo, Thais — vê e edita a agenda das duas lojas em qualquer computador. A seleção de loja (tela inicial + ⚙) só define o valor padrão do campo "Loja" ao criar uma viagem nova.

## Estrutura

```
motorista/
├── index.html            # shell da página (telas: loja, config, calendário, dia, formulário)
├── app.css                # identidade visual + estilos do calendário/dia/formulário
├── app.js                 # lógica da interface
├── lib/
│   └── store.js           # camada de dados (modo local ou planilha, mesmo padrão do Estoque)
├── apps-script/
│   └── Codigo.gs           # backend (Web App) a publicar na planilha compartilhada
└── icons/
    └── icon48.png          # logo Casa Timoni
```

## Origem

Padronizado a partir do protótipo pessoal do usuário (Send, shareId `ffpHzHXD`), evoluído para uma agenda real (calendário + dados compartilhados) a partir do feedback de uso com a equipe.
