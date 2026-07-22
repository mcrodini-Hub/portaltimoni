# Agenda de Motorista — Portal Timoni

Página única (HTML/CSS/JS, sem dependências externas) para montar a agenda diária de viagens do motorista e gerar o texto pronto para o WhatsApp. Segue a identidade visual do Portal Timoni (azul `#2c4be0`, cabeçalho creme, cards brancos) usada no Hub de Pedidos.

## Como usar

Abra `index.html` direto no navegador (desktop ou celular) — não precisa de instalação, servidor ou build. Pode ser aberto como arquivo local ou hospedado como página estática (GitHub Pages, etc.).

## Funcionalidades

- **Várias viagens**: botão "+ Nova viagem" adiciona quantos blocos forem necessários; cada um pode ser removido individualmente.
- **Busca de CEP**: campo opcional que consulta a [ViaCEP](https://viacep.com.br/) e preenche logradouro/bairro/cidade automaticamente.
- **Geração de texto para WhatsApp**: monta o texto com negrito (`*assim*`) a partir dos campos preenchidos, atualizado em tempo real.
- **Validação de campos obrigatórios**: campos marcados com `*` são obrigatórios; ao tentar copiar sem preenchê-los, os campos inválidos ficam destacados e o foco vai para o primeiro pendente.
- **Anexos (dividir pedido entre empresas)**: quando uma viagem tem mais de uma nota fiscal, permite detalhar itens por empresa.
- **Preenchido por**: identifica quem montou a viagem (Ciça, Jaqueline, Jeovana, Reginaldo, Thais).
- **Impressão**: por viagem individual ou da agenda inteira.
- **Exportação em Excel**: gera um `.xls` (SpreadsheetML) com uma linha por viagem, todas as colunas preenchidas.

## Acessos

Sem restrição por pessoa ou por loja: é um motorista só para as duas lojas (Rio Claro e Araras), então qualquer um dos 5 caixas — Ciça, Jaqueline, Jeovana, Reginaldo, Thais — pode escolher qualquer loja em qualquer computador. A seleção de loja (tela inicial + pill no topbar) serve só para rotular a agenda gerada, não é um controle de permissão.

## Estrutura

```
agenda-motorista/
├── index.html      # página completa (estilo + lógica)
└── icons/
    └── icon48.png   # logo Casa Timoni, reaproveitado do Hub de Pedidos
```

## Origem

Padronizado a partir do protótipo pessoal do usuário (Send, shareId `ffpHzHXD`), mantendo 100% das funções originais e aplicando a identidade visual do Portal Timoni.
