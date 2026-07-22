# Planilha compartilhada — passo a passo

Este é o modo **planilha** (real), em que balcão, estoque e gestão, em computadores
diferentes, veem e atualizam **a mesma fila**. Use o arquivo pronto
[`Estoque-Portal-Timoni.xlsx`](Estoque-Portal-Timoni.xlsx) — ele já vem com as três abas
certas (`Produtos`, `Necessidades`, `Vendedores`) e os nomes de vendedores cadastrados.

## 1. Subir a planilha para o Google

1. Acesse **drive.google.com** → **Novo → Upload de arquivo** → selecione
   `Estoque-Portal-Timoni.xlsx`.
2. Abra o arquivo enviado e, se abrir como Excel, vá em **Arquivo → Salvar como
   Planilhas Google** (para virar uma Planilha Google editável).
3. Confira as três abas na parte de baixo: **Produtos**, **Necessidades**, **Vendedores**.
   - `Produtos` já traz um catálogo de exemplo — **troque pelo catálogo real** (código e
     descrição) quando quiser.
   - `Necessidades` começa só com o cabeçalho (a extensão preenche sozinha).
   - `Vendedores` já traz os nomes por loja (`nome` | `unidade`; unidade em branco = aparece
     nas duas lojas).

## 2. Publicar o backend (Apps Script)

1. Na planilha, menu **Extensões → Apps Script**.
2. Apague o conteúdo padrão, cole todo o arquivo
   [`../Codigo.gs`](../Codigo.gs) e **salve** (ícone de disquete).
3. Clique em **Implantar → Nova implantação**:
   - Tipo (engrenagem): **App da Web**
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
4. **Implantar** e autorize o acesso quando o Google pedir (é a sua própria planilha).
5. Copie a **URL do app da Web** — termina em **`/exec`**.

## 3. Ligar a extensão à planilha (em cada computador)

1. Abra a extensão e clique no **⚙** (topo).
2. Cole a URL em **"Planilha compartilhada"** e clique **Salvar e testar**.
3. Aparecendo **conexão OK**, pronto: aquele computador está no modo planilha.
4. Repita em cada máquina (balcão Rio Claro, balcão Araras, Lucas, gestão…).

## Testar se está compartilhando

- Num computador, crie um pedido (perfil Vendedores).
- Em outro (perfil Estoque ou Gestão), clique **Atualizar** — o pedido deve aparecer.
- Ligue as **notificações** no ⚙ para ser avisada quando entrar pedido ou o estoque responder.

## Estrutura das abas (referência)

- **Produtos**: `codigo` | `descricao`
- **Necessidades**: `id` | `codigo` | `descricao` | `status` | `criadoEm` | `respondidoEm` |
  `numeroPedido` | `previsaoEntrega` | `observacao` | `clienteAguardando` | `unidade` |
  `vendedor` | `quantidade` | `notaVendedor` | `chegouEm`
- **Vendedores**: `nome` | `unidade`
