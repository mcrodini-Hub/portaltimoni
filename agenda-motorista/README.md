# Agenda de Motorista — Portal Timoni

Página única (desktop e celular) para montar a **agenda de entregas e retiradas** da Casa Timoni
e gerar o texto pronto para colar no **WhatsApp**, já com os trechos em *negrito*. Padronizada
na identidade visual do Portal (azul Timoni, cabeçalho creme, cards) — mesma linguagem dos
demais módulos (Estoque/HUB).

## Formato

É um **arquivo único** (`index.html`), sem instalação nem servidor. Abre no navegador do
computador ou do celular. Escolhemos página (e não extensão) porque é uma ferramenta que gera
texto e precisa funcionar no celular da equipe e do motorista.

## O que faz

- **Várias viagens** na mesma agenda, com separador entre elas no texto final.
- **Busca de CEP** (ViaCEP) que preenche o endereço; é só completar número/complemento.
- **Texto pronto para o WhatsApp**, com data/endereço, horário (entrega ou retirada),
  pedido/fornecedor, contato, detalhamento dos itens, volume e "outras informações" —
  os títulos já saem em *negrito*.
- **Anexos (dividir pedido entre empresas)**: quando um total vira mais de uma nota fiscal,
  lista cada empresa com seus itens.
- **Preenchido por**: registra quem montou a agenda.
- **Copiar texto**, **Imprimir** (a agenda toda ou uma viagem) e **Gerar Relatório Excel**
  (planilha `.xls` com uma linha por viagem).
- **Validação**: destaca os campos obrigatórios que faltam antes de copiar/imprimir
  (data, horário, endereço, número, cliente/fornecedor, NF/pedido, contato, volume,
  preenchido por).
- **Formatação automática** de horário (`930` → `9:30`) e de telefone `(xx) xxxxx-xxxx`.

## Como usar

1. Abra `index.html` (duplo clique, ou hospede a pasta e acesse pela URL).
2. Preencha a(s) viagem(ns). O texto do WhatsApp é gerado em tempo real ao lado.
3. **Copiar texto** e colar na conversa — ou **Imprimir** / **Gerar Relatório Excel**.

> A busca de CEP e a geração do Excel abrem uma aba/pop-up; se o navegador bloquear,
> permita pop-ups para este arquivo/site.

## Estrutura

```
agenda-motorista/
├── index.html   # a página completa (interface + lógica, sem dependências)
└── README.md
```

## Próximos passos possíveis

- Lista de motoristas/rotas e envio direto por link do WhatsApp.
- Histórico das agendas geradas (hoje cada uso começa em branco).
- Integração com o módulo de Estoque/pedidos para puxar NF/fornecedor automaticamente.
