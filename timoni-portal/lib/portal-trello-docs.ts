import { normalizeTrelloText, trelloFetch, type TrelloCredentials } from "@/lib/trello";

const BOARD = "tZi5fLDT";
const portal = "https://portaltimoni.vercel.app";
const repo = "https://github.com/mcrodini-Hub/portaltimoni";

type TrelloList = { id: string; name: string; closed?: boolean };
type TrelloCard = { id: string; name: string; desc?: string; idList: string; closed?: boolean };
type TrelloBoard = { id: string; name: string; lists?: TrelloList[]; cards?: TrelloCard[] };
type CardSpec = { name: string; desc: string };
type ModuleSpec = { aliases: string[]; cards: CardSpec[] };

function makeModule(
  aliases: string[],
  status: string,
  objective: string,
  links: string,
  done: string,
  pending: string,
  improvements: string,
): ModuleSpec {
  return {
    aliases,
    cards: [
      { name: "01 — Descrição e objetivo", desc: `STATUS: ${status}\nData de referência: 08/08/2026\n\n${objective}` },
      { name: "02 — Links, acessos e permissões", desc: links },
      { name: "03 — Status e versão atual", desc: `${status}\n\n${done}` },
      { name: "04 — Pendências / problemas", desc: pending },
      { name: "05 — Melhorias futuras", desc: improvements },
    ],
  };
}

const moduleSpecs: ModuleSpec[] = [
  makeModule(
    ["painel", "painel timoni"],
    "PRONTO / OPERACIONAL",
    "Portal central da Casa Timoni para organizar acesso aos módulos, sistemas internos e ferramentas operacionais. Infraestrutura: Vercel, projeto portaltimoni, root timoni-portal, produção pela branch main.",
    `Portal: ${portal}\nGitHub: ${repo}\n\nPermissões: todos os usuários cadastrados possuem acesso ao Painel. Regra: manter a troca de módulo/tela disponível em todas as páginas.`,
    "Já realizado:\n- Portal publicado\n- Navegação principal\n- Login Google\n- Estrutura dos módulos\n- Deploy automático\n- Integrações internas e externas",
    "- Padronizar botão de troca de tela\n- Finalizar logo oficial onde necessário\n- Revisar permissões\n- Remover atalhos duplicados ou obsoletos",
    "- Visão geral do status dos módulos\n- Administração centralizada de permissões\n- Indicadores rápidos\n- Documentação técnica centralizada",
  ),
  makeModule(
    ["estoque"],
    "PRONTO / OPERACIONAL",
    "Sistema de consulta e operação de estoque. A interface operacional atual é a extensão Chrome; planilhas e Apps Script não devem ser a interface principal.",
    `Portal: ${portal}\nGitHub: ${repo}\n\nPermissões atuais: todos os usuários cadastrados no Portal possuem acesso ao Estoque.`,
    "Já realizado:\n- Integração com Portal\n- Extensão Chrome operacional\n- Backend separado da interface\n- Controle de acesso pelo Portal",
    "- Registrar versão oficial da extensão\n- Garantir backup do ZIP\n- Manter procedimento simples de reinstalação",
    "- Histórico de versões\n- Documentar instalação e recuperação\n- Centralizar permissões",
  ),
  makeModule(
    ["motorista", "agenda motorista", "agenda/motorista"],
    "PRONTO / OPERACIONAL",
    "Sistema de agendamento e acompanhamento de viagens e entregas de Araras e Rio Claro, com tela de equipe para cadastro/edição e tela simplificada de leitura para o motorista.",
    `Equipe: ${portal}/dashboard/motorista\nMotorista: ${portal}/motorista\nPlanilha: https://docs.google.com/spreadsheets/d/1vDLItnvuqeC75q01z9pEbOPNjfbfRs_ISyPHOq8GCyo/edit?usp=drive_link\nImpressão: https://docs.google.com/document/d/1fu5E6sJtYPNoaaRJVCtQuevpS-7ynexeBaJixjCkihU/edit?usp=drive_link\n\nPermissões atuais: Ciça, Marcelo, Margareth, Jeovana, Estoque Araras, Carolina Araras, Jaqueline e Thais. Motorista: somente leitura, sem senha adicional.`,
    "Já realizado:\n- Tela da equipe\n- Tela separada do motorista\n- Rota\n- Impressão\n- Cadastro e edição\n- Visualização Dia e Mês\n- Remoção de Duplicar e Excel",
    "- Validar impressão de todas as entregas do dia\n- Acompanhar uso real no celular\n- Manter separados Vendedor e Preenchido por",
    "- Indicador de viagem concluída\n- Registro de usuário que criou/alterou\n- Melhorias de impressão e mobile",
  ),
  makeModule(
    ["reunioes", "reuniões", "reuniao", "reunião"],
    "PRONTO",
    "Organização das reuniões de resultados de Araras e Rio Claro, com estrutura padronizada em Drive, Docs, Slides e Agenda Ciça.",
    "Pauta: https://docs.google.com/document/d/1NoZASmMc-ptrqFy8zbvtGgCJjLJxX8GsORM-F4N799k/edit\nApresentação: https://docs.google.com/presentation/d/1AK7mw2-ifR-ChlRuun_4O9FIr3ThmZvzfVMA_ryZgXA/edit\nAta: https://docs.google.com/document/d/1S9dQlOGwFE8RwNnjw1PFy08DH9a6k1_9kugQEBgmxHQ/edit\n\nDrive: REUNIÕES / 2026 / ARARAS e RIO CLARO. Permissões no Portal: Ciça, Marcelo e Margareth.",
    "Regras atuais:\n- Manter sempre 2 próximas reuniões de cada unidade\n- Araras: 7h40\n- Rio Claro: mensal, com exceções definidas\n- Finalizar ata e assinaturas após a reunião",
    "- Finalizar atas e assinaturas\n- Manter agenda futura atualizada\n- Evitar duplicidade de documentos",
    "- Criar ata automaticamente\n- Automatizar próximas datas\n- Histórico anual por unidade",
  ),
  makeModule(
    ["agenda cica", "agenda ciça", "agenda cissa", "agenda"],
    "OPERACIONAL / EM FINALIZAÇÃO",
    "Agenda pessoal e administrativa dentro do Portal para compromissos, reuniões, consultorias, tarefas e prazos.",
    `Acesso: ${portal}/agenda\n\nPermissões atuais: Ciça e Margareth. Marcelo não possui acesso à Agenda Ciça no access-control atual.`,
    "Já realizado:\n- Google Calendar\n- Próximos 7 eventos\n- Visualização mês e ano\n- Criar, editar e cancelar compromissos",
    "- Concluídos devem sair da lista principal\n- Permanecer visíveis no histórico\n- Revisar sincronização",
    "- Melhorar histórico de concluídos\n- Manter próximos 7 eventos como padrão",
  ),
  makeModule(
    ["compras"],
    "EM DESENVOLVIMENTO",
    "Fluxo estratégico de compras com Trello, extensão Chrome e conferência, priorizando velocidade, redução de erros e acompanhamento dos pedidos.",
    `Trello Compras: https://trello.com/b/UfPrTr1H/compras\nPortal: ${portal}/dashboard/compras\nGitHub: ${repo}\n\nPermissões atuais: Ciça, Marcelo e Margareth.`,
    "Já realizado:\n- Integração Trello\n- Extensão Chrome\n- Regras de fornecedores e urgentes\n- Leitura de itens de planilha\n- Regras de atualização de pedido",
    "- Consolidar ZIP oficial\n- Validar filtros\n- Finalizar integração da conferência\n- Garantir estabilidade",
    "- Reduzir etapas manuais\n- Integrar conferência ao pedido\n- Manter rastreabilidade sem burocracia",
  ),
  makeModule(
    ["conferencia", "conferência"],
    "EM DESENVOLVIMENTO",
    "Comparação automática entre pedido interno e documento do fornecedor para eliminar erros antes da aprovação da compra.",
    `Portal: ${portal}\nGitHub: ${repo}\n\nPermissões atuais: Ciça, Marcelo e Margareth.`,
    "Já definido:\n- Comparação pedido x fornecedor\n- Preço divergente em amarelo\n- Outras divergências em laranja\n- Excel no padrão definido",
    "- Integrar à extensão de Compras\n- Fixar planilha-modelo\n- Automatizar nome final\n- Testar fornecedores diferentes",
    "- Análise automática e direta\n- Exibir apenas divergências relevantes\n- Reduzir tempo de aprovação",
  ),
  makeModule(
    ["marketing"],
    "ESTRUTURA DEFINIDA / FORA DO PORTAL",
    "Marketing orientado a vendas e resultados, com estratégias diferentes para Rio Claro e Araras. Consultor atual: Bruno.",
    "Trello: https://trello.com/b/6HcTFpSp/ct-marketing\nDrive: https://drive.google.com/drive/folders/1zSvHeO4YmWOSRp4i_CBTSxleBBIzfdPD\nWhatsApp: https://chat.whatsapp.com/KpDNo1RZOsV2cvb3qEB3py\n\nAcesso: Ciça e Marcelo.",
    "Já realizado:\n- Encerramento Agência Santis\n- Bruno como consultor\n- Reuniões quinzenais\n- Trello, Drive e WhatsApp definidos",
    "- Registrar campanhas e decisões\n- Conectar marketing a vendas e produtos\n- Não duplicar fluxo dentro do Portal",
    "- Dashboard executivo futuro\n- Indicadores campanha x vendas\n- Estratégias específicas por cidade",
  ),
  makeModule(
    ["financeiro"],
    "A DEFINIR / NÃO IMPLEMENTADO",
    "Módulo financeiro do Portal ainda precisa de escopo claro antes do desenvolvimento.",
    `Portal: ${portal}\nGitHub: ${repo}\n\nO access-control já prevê permissões para Financeiro, mas a estrutura funcional ainda não está consolidada.`,
    "Já existe espaço na arquitetura do Portal e permissões previstas.",
    "Definir objetivo, fontes de dados, usuários, indicadores, relatórios e integrações necessárias.",
    "Só desenvolver após definição do fluxo financeiro real.",
  ),
  makeModule(
    ["tela inicial cica", "tela inicial ciça", "inicio cica", "início ciça"],
    "EM AJUSTE",
    "Tela operacional principal da Ciça dentro do Portal, com atalhos para módulos e sistemas prioritários.",
    `Portal: ${portal}\n\nO acesso aos módulos continua controlado individualmente pelo access-control.`,
    "Já definido:\n- Atalhos para módulos\n- Navegação superior\n- Acesso rápido\n- Regra de troca de tela em todas as páginas",
    "- Conferir botão de troca de tela\n- Remover atalhos redundantes\n- Manter somente informação útil",
    "- Painel pessoal enxuto\n- Priorizar compromissos, pendências e acessos frequentes",
  ),
];

function findList(lists: TrelloList[], aliases: string[]) {
  return lists.find((list) => {
    const listName = normalizeTrelloText(list.name);
    return aliases.some((alias) => {
      const normalizedAlias = normalizeTrelloText(alias);
      return listName === normalizedAlias || listName.includes(normalizedAlias);
    });
  });
}

export async function syncPortalTrelloDocs(credentials: TrelloCredentials) {
  const board = await trelloFetch<TrelloBoard>(`/boards/${BOARD}`, {
    credentials,
    params: {
      fields: "name",
      lists: "open",
      list_fields: "name,closed",
      cards: "open",
      card_fields: "name,desc,idList,closed",
    },
  });

  const lists = (board.lists || []).filter((list) => !list.closed);
  const cards = (board.cards || []).filter((card) => !card.closed);
  const created: string[] = [];
  const updated: string[] = [];
  const missingLists: string[] = [];

  for (const moduleSpec of moduleSpecs) {
    const list = findList(lists, moduleSpec.aliases);
    if (!list) {
      missingLists.push(moduleSpec.aliases[0]);
      continue;
    }

    for (const cardSpec of moduleSpec.cards) {
      const normalizedName = normalizeTrelloText(cardSpec.name);
      const existing = cards.find(
        (card) => card.idList === list.id && normalizeTrelloText(card.name) === normalizedName,
      );

      if (existing) {
        if ((existing.desc || "") !== cardSpec.desc || existing.name !== cardSpec.name) {
          await trelloFetch(`/cards/${existing.id}`, {
            method: "PUT",
            credentials,
            params: { name: cardSpec.name, desc: cardSpec.desc },
          });
          updated.push(`${list.name} / ${cardSpec.name}`);
        }
      } else {
        const createdCard = await trelloFetch<TrelloCard>("/cards", {
          method: "POST",
          credentials,
          params: { idList: list.id, name: cardSpec.name, desc: cardSpec.desc, pos: "bottom" },
        });
        cards.push({ ...createdCard, idList: list.id, name: cardSpec.name, desc: cardSpec.desc });
        created.push(`${list.name} / ${cardSpec.name}`);
      }
    }
  }

  return { board: board.name, created, updated, missingLists };
}
