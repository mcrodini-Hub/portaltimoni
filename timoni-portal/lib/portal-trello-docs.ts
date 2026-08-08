import { normalizeTrelloText, trelloFetch, type TrelloCredentials } from "@/lib/trello";

const PORTAL_BOARD_SHORT_LINK = "tZi5fLDT";

const portal = "https://portaltimoni.vercel.app";
const repo = "https://github.com/mcrodini-Hub/portaltimoni";

type TrelloList = { id: string; name: string; closed?: boolean };
type TrelloCard = { id: string; name: string; desc?: string; idList: string; closed?: boolean };
type TrelloBoard = { id: string; name: string; lists?: TrelloList[]; cards?: TrelloCard[] };

type CardSpec = { name: string; desc: string };
type ModuleSpec = { aliases: string[]; cards: CardSpec[] };

const modules: ModuleSpec[] = [
  {
    aliases: ["painel", "painel timoni"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: `STATUS: PRONTO / OPERACIONAL\nData de referência: 08/08/2026\n\nPortal central da Casa Timoni para organizar acesso aos módulos, sistemas internos e ferramentas operacionais.\n\nProdução: ${portal}\nRepositório: ${repo}\n\nInfraestrutura:\n- Vercel\n- Projeto: portaltimoni\n- Time: timoni\n- Root Directory: timoni-portal\n- Branch de produção: main\n- Deploy automático pela main` },
      { name: "02 — Links, acessos e permissões", desc: `Portal: ${portal}\nGitHub: ${repo}\n\nPermissões atuais: acesso ao Painel para todos os usuários cadastrados no access-control do Portal.\n\nRegra de navegação: o acesso para troca de módulo/tela deve permanecer disponível em todas as páginas.` },
      { name: "03 — Status e versão atual", desc: "PRONTO / OPERACIONAL\n\nJá realizado:\n- Portal publicado em produção\n- Navegação principal\n- Login Google\n- Estrutura dos módulos\n- Deploy automático\n- Integração com módulos internos e links externos" },
      { name: "04 — Pendências / problemas", desc: "- Conferir padronização do botão de troca de tela em todos os módulos\n- Finalizar logo oficial onde ainda houver versão provisória\n- Revisar permissões por usuário/módulo\n- Manter dashboard sem atalhos duplicados ou obsoletos" },
      { name: "05 — Melhorias futuras", desc: "- Visão geral do status dos módulos\n- Administração centralizada de permissões\n- Indicadores rápidos no dashboard\n- Padronização visual entre módulos\n- Centralizar documentação técnica\n- Evitar duplicação de funções entre Portal, Drive, Trello e extensões" },
    ],
  },
  {
    aliases: ["estoque"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: PRONTO / OPERACIONAL\nData de referência: 08/08/2026\n\nSistema para consulta e operação de estoque. A interface operacional atual é a extensão do Chrome; planilhas e Apps Script não devem ser apresentados como interface principal." },
      { name: "02 — Links, acessos e permissões", desc: `Portal: ${portal}\nRepositório: ${repo}\n\nPermissões atuais segundo access-control: todos os usuários cadastrados no Portal possuem acesso ao módulo Estoque.\n\nA operação deve separar funções administrativas das funções de consulta quando necessário.` },
      { name: "03 — Status e versão atual", desc: "PRONTO / OPERACIONAL\n\nJá realizado:\n- Integração com o Portal\n- Extensão Chrome como interface operacional\n- Backend separado da interface\n- Acesso controlado pelo Portal" },
      { name: "04 — Pendências / problemas", desc: "- Registrar versão oficial da extensão instalada\n- Garantir backup do ZIP oficial\n- Manter procedimento simples de reinstalação\n- Evitar recriar uma segunda interface de Estoque sem necessidade" },
      { name: "05 — Melhorias futuras", desc: "- Centralizar permissões\n- Criar histórico de versões da extensão\n- Documentar instalação e recuperação\n- Criar card técnico específico apenas quando houver incidente ou alteração" },
    ],
  },
  {
    aliases: ["motorista", "agenda motorista", "agenda/motorista"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: PRONTO / OPERACIONAL\nData de referência: 08/08/2026\n\nSistema de agendamento e acompanhamento de viagens e entregas de Araras e Rio Claro. Possui duas interfaces: equipe para cadastro/edição e motorista para leitura simples no celular." },
      { name: "02 — Links, acessos e permissões", desc: `Equipe: ${portal}/dashboard/motorista\nMotorista: ${portal}/motorista\nPlanilha: https://docs.google.com/spreadsheets/d/1vDLItnvuqeC75q01z9pEbOPNjfbfRs_ISyPHOq8GCyo/edit?usp=drive_link\nModelo impressão: https://docs.google.com/document/d/1fu5E6sJtYPNoaaRJVCtQuevpS-7ynexeBaJixjCkihU/edit?usp=drive_link\n\nPermissões atuais no Portal: Ciça, Marcelo, Margareth, Jeovana, Estoque Araras, Carolina Araras, Jaqueline e Thais.\nTela do motorista: somente leitura e sem senha adicional da aplicação.` },
      { name: "03 — Status e versão atual", desc: "PRONTO / OPERACIONAL\n\nJá realizado:\n- Tela de agendamento da equipe\n- Tela separada para motorista\n- Araras e Rio Claro juntas na leitura do motorista\n- Rota\n- Impressão\n- Cadastro e edição\n- Visualização Dia com opção Mês\n- Remoção dos botões Duplicar e Excel" },
      { name: "04 — Pendências / problemas", desc: "- Validar impressão de todas as entregas do dia\n- Acompanhar uso real no celular\n- Manter separados Vendedor e Preenchido por\n- Revisar apenas problemas encontrados no uso real" },
      { name: "05 — Melhorias futuras", desc: "- Indicador de viagem concluída\n- Registro de usuário que criou/alterou a viagem\n- Melhorias de impressão diária\n- Melhorar experiência mobile sem adicionar complexidade ao motorista" },
    ],
  },
  {
    aliases: ["reunioes", "reuniões", "reuniao", "reunião"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: PRONTO\nData de referência: 08/08/2026\n\nOrganização das reuniões de resultados de Araras e Rio Claro com Google Drive, Docs, Slides e Agenda Ciça. Estrutura documental padronizada por unidade." },
      { name: "02 — Links, acessos e permissões", desc: "Pauta: https://docs.google.com/document/d/1NoZASmMc-ptrqFy8zbvtGgCJjLJxX8GsORM-F4N799k/edit\nApresentação padrão: https://docs.google.com/presentation/d/1AK7mw2-ifR-ChlRuun_4O9FIr3ThmZvzfVMA_ryZgXA/edit\nAta/modelo: https://docs.google.com/document/d/1S9dQlOGwFE8RwNnjw1PFy08DH9a6k1_9kugQEBgmxHQ/edit\n\nEstrutura Drive: REUNIÕES / 2026 / ARARAS e REUNIÕES / 2026 / RIO CLARO\nPermissões atuais do módulo no Portal: Ciça, Marcelo e Margareth." },
      { name: "03 — Status e versão atual", desc: "PRONTO\n\nRegras atuais:\n- Manter sempre as 2 próximas reuniões de cada unidade\n- Araras: horário padrão 7h40\n- Rio Claro: mensal, com exceções quando definidas\n- Finalizar ata e assinaturas após cada reunião" },
      { name: "04 — Pendências / problemas", desc: "- Finalizar ata e assinaturas após cada reunião\n- Manter agenda futura atualizada\n- Evitar duplicidade de documentos\n- Preservar separação por unidade e ano" },
      { name: "05 — Melhorias futuras", desc: "- Criar ata automaticamente a partir da reunião anterior\n- Automatizar criação das próximas datas\n- Lembrete para finalizar ata e colher assinaturas\n- Criar histórico anual por unidade" },
    ],
  },
  {
    aliases: ["agenda cica", "agenda ciça", "agenda cissa", "agenda"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: OPERACIONAL / EM FINALIZAÇÃO\n\nAgenda pessoal e administrativa dentro do Portal Timoni para compromissos, reuniões, consultorias, tarefas e prazos." },
      { name: "02 — Links, acessos e permissões", desc: `Acesso: ${portal}/agenda\n\nPermissões atuais no Portal: Ciça e Margareth. Marcelo não possui acesso à Agenda Ciça no access-control atual.` },
      { name: "03 — Status e versão atual", desc: "Já realizado:\n- Integração com Google Calendar\n- Próximos 7 eventos a partir de hoje\n- Visualizações mês e ano\n- Criar, editar e cancelar compromissos\n- Reuniões e consultorias integradas" },
      { name: "04 — Pendências / problemas", desc: "- Eventos concluídos devem sair da lista principal\n- Permanecer visíveis ao consultar períodos anteriores\n- Revisar sincronização após mudanças do Google Calendar" },
      { name: "05 — Melhorias futuras", desc: "- Melhorar histórico de concluídos sem poluir a tela atual\n- Manter próximos 7 eventos como padrão\n- Evitar duplicidade entre Agenda Ciça e Agenda/Motorista" },
    ],
  },
  {
    aliases: ["compras"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: EM DESENVOLVIMENTO\n\nFluxo estratégico de compras com Trello, extensão Chrome e conferência, priorizando velocidade, redução de erros e acompanhamento dos pedidos." },
      { name: "02 — Links, acessos e permissões", desc: `Trello Compras: https://trello.com/b/UfPrTr1H/compras\nPortal: ${portal}/dashboard/compras\nRepositório: ${repo}\n\nPermissões atuais no Portal: Ciça, Marcelo e Margareth.` },
      { name: "03 — Status e versão atual", desc: "Já realizado:\n- Integração Trello no Portal\n- Extensão Chrome\n- Regras de fornecedores e pedidos urgentes\n- Organização dos cards\n- Leitura de itens de planilha\n- Preparação da conferência\n- Regras de atualização de pedido" },
      { name: "04 — Pendências / problemas", desc: "- Consolidar ZIP oficial da extensão\n- Validar definitivamente filtro das planilhas\n- Finalizar integração da conferência\n- Garantir estabilidade da abertura de cards\n- Criar backup da versão oficial" },
      { name: "05 — Melhorias futuras", desc: "- Reduzir etapas manuais\n- Manter processo diário dentro do limite operacional definido\n- Aumentar rastreabilidade sem burocracia\n- Integrar conferência diretamente ao pedido" },
    ],
  },
  {
    aliases: ["conferencia", "conferência"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: EM DESENVOLVIMENTO\n\nComparação automática entre pedido interno e documento do fornecedor para eliminar erros antes da aprovação da compra." },
      { name: "02 — Links, acessos e permissões", desc: `Portal: ${portal}\nRepositório: ${repo}\n\nPermissões atuais no Portal: Ciça, Marcelo e Margareth.` },
      { name: "03 — Status e versão atual", desc: "Já definido:\n- Comparação pedido interno x fornecedor\n- Divergência de preço em amarelo\n- Demais divergências em laranja\n- Geração de Excel no padrão definido\n- Processo orientado a reduzir conferência manual" },
      { name: "04 — Pendências / problemas", desc: "- Integrar definitivamente à extensão de Compras\n- Fixar planilha-modelo\n- Automatizar nome do arquivo final\n- Testar fornecedores e formatos diferentes" },
      { name: "05 — Melhorias futuras", desc: "- Tornar análise automática e direta\n- Exibir somente divergências relevantes\n- Reduzir tempo de aprovação\n- Manter padrão único de saída" },
    ],
  },
  {
    aliases: ["marketing"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: ESTRUTURA DEFINIDA / FORA DO PORTAL\n\nMarketing orientado a vendas e resultados, com estratégias diferentes para Rio Claro e Araras. Consultor atual: Bruno." },
      { name: "02 — Links, acessos e permissões", desc: "Trello: https://trello.com/b/6HcTFpSp/ct-marketing\nDrive: https://drive.google.com/drive/folders/1zSvHeO4YmWOSRp4i_CBTSxleBBIzfdPD\nWhatsApp: https://chat.whatsapp.com/KpDNo1RZOsV2cvb3qEB3py\n\nPermissões atuais no Portal: Ciça e Marcelo.\nDecisão: Marketing permanece fora do Portal operacionalmente por enquanto." },
      { name: "03 — Status e versão atual", desc: "Já realizado:\n- Encerramento da Agência Santis\n- Novo consultor Bruno\n- Reuniões quinzenais desde 06/08/2026 às 15h30\n- Trello, Drive e grupo WhatsApp definidos" },
      { name: "04 — Pendências / problemas", desc: "- Manter reuniões quinzenais\n- Registrar campanhas e decisões no Trello\n- Conectar ações de marketing a vendas e produtos\n- Não duplicar o fluxo operacional dentro do Portal" },
      { name: "05 — Melhorias futuras", desc: "- Dashboard executivo futuro no Portal\n- Indicadores de campanha x vendas\n- Histórico de decisões por período\n- Estratégias específicas por cidade" },
    ],
  },
  {
    aliases: ["financeiro"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: A DEFINIR / NÃO IMPLEMENTADO\n\nMódulo financeiro do Portal ainda precisa de escopo claro antes do desenvolvimento." },
      { name: "02 — Links, acessos e permissões", desc: `Portal: ${portal}\nRepositório: ${repo}\n\nO access-control já possui permissões para o módulo Financeiro, mas a estrutura funcional ainda precisa ser consolidada.` },
      { name: "03 — Status e versão atual", desc: "Ainda não implementado como módulo funcional completo. Já existe previsão de acesso e espaço na arquitetura do Portal." },
      { name: "04 — Pendências / problemas", desc: "Definir antes de desenvolver:\n- Objetivo do módulo\n- Fontes de dados\n- Usuários\n- Indicadores\n- Relatórios\n- Integrações realmente necessárias" },
      { name: "05 — Melhorias futuras", desc: "Somente iniciar desenvolvimento após definição do fluxo financeiro real, evitando criar telas sem uso operacional claro." },
    ],
  },
  {
    aliases: ["tela inicial cica", "tela inicial ciça", "inicio cica", "início ciça"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: EM AJUSTE\n\nTela operacional principal da Ciça dentro do Portal, com atalhos para módulos e sistemas prioritários." },
      { name: "02 — Links, acessos e permissões", desc: `Portal: ${portal}\n\nA tela é parte do fluxo administrativo da Ciça. O acesso aos módulos continua sendo controlado individualmente pelo access-control.` },
      { name: "03 — Status e versão atual", desc: "Já definido:\n- Atalhos para módulos\n- Navegação superior\n- Acesso rápido aos sistemas principais\n- Regra de troca de tela em todas as páginas" },
      { name: "04 — Pendências / problemas", desc: "- Conferir consistência do botão de troca de tela em todas as páginas\n- Remover atalhos redundantes\n- Manter somente informações úteis para operação diária" },
      { name: "05 — Melhorias futuras", desc: "- Tornar a tela um painel pessoal enxuto\n- Priorizar próximos compromissos, pendências e acessos frequentes\n- Evitar excesso de informações" },
    ],
  },
];

function findList(lists: TrelloList[], aliases: string[]) {
  return lists.find((list) => {
    const name = normalizeTrelloText(list.name);
    return aliases.some((alias) => {
      const normalizedAlias = normalizeTrelloText(alias);
      return name === normalizedAlias || name.includes(normalizedAlias);
    });
  });
}

export async function syncPortalTrelloDocs(credentials: TrelloCredentials) {
  const board = await trelloFetch<TrelloBoard>(`/boards/${PORTAL_BOARD_SHORT_LINK}`, {
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

  for (const module of modules) {
    const list = findList(lists, module.aliases);
    if (!list) {
      missingLists.push(module.aliases[0]);
      continue;
    }

    for (const spec of module.cards) {
      const normalizedName = normalizeTrelloText(spec.name);
      const existing = cards.find(
        (card) => card.idList === list.id && normalizeTrelloText(card.name) === normalizedName,
      );

      if (existing) {
        if ((existing.desc || "") !== spec.desc || existing.name !== spec.name) {
          await trelloFetch(`/cards/${existing.id}`, {
            method: "PUT",
            credentials,
            params: { name: spec.name, desc: spec.desc },
          });
          updated.push(`${list.name} / ${spec.name}`);
        }
      } else {
        const createdCard = await trelloFetch<TrelloCard>("/cards", {
          method: "POST",
          credentials,
          params: { idList: list.id, name: spec.name, desc: spec.desc, pos: "bottom" },
        });
        cards.push({ ...createdCard, idList: list.id, name: spec.name, desc: spec.desc });
        created.push(`${list.name} / ${spec.name}`);
      }
    }
  }

  return {
    board: board.name,
    created,
    updated,
    missingLists,
  };
}
