import { auth } from "@/lib/auth";
import { normalizeEmail } from "@/lib/access-control";
import { getStoredTrelloCredentials, normalizeTrelloText, trelloFetch } from "@/lib/trello";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOARD = "tZi5fLDT";

type TrelloList = { id: string; name: string; closed?: boolean };
type TrelloCard = { id: string; name: string; desc?: string; idList: string; closed?: boolean };
type TrelloBoard = { id: string; name: string; lists?: TrelloList[]; cards?: TrelloCard[] };

type CardSpec = { name: string; desc: string };
type ModuleSpec = { aliases: string[]; cards: CardSpec[] };

const portal = "https://portaltimoni.vercel.app";
const repo = "https://github.com/mcrodini-Hub/portaltimoni";

const specs: ModuleSpec[] = [
  {
    aliases: ["painel", "painel timoni"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: `STATUS: PRONTO\nData de referência: 07/08/2026\n\nPortal central da Casa Timoni para organizar o acesso aos módulos, sistemas internos e ferramentas operacionais.\n\nEstrutura técnica:\n- Vercel\n- Projeto: portaltimoni\n- Time: timoni\n- Root Directory: timoni-portal\n- Branch de produção: main\n- Deploy automático pela branch main` },
      { name: "02 — Links, acessos e permissões", desc: `Portal: ${portal}\nGitHub: ${repo}\n\nPermissões atuais no Portal: acesso ao Painel para todos os usuários cadastrados no access-control.\n\nRegra: o acesso para troca de módulo/tela deve estar disponível em todas as páginas do Portal.` },
      { name: "03 — Status e versão atual", desc: "PRONTO / OPERACIONAL\n\nJá realizado:\n- Portal publicado em produção\n- Navegação principal\n- Login Google\n- Estrutura dos módulos\n- Deploy automático\n- Integração com módulos internos e links externos" },
      { name: "04 — Pendências / problemas", desc: "- Conferir padronização do botão de troca de tela em todos os módulos\n- Finalizar logo oficial onde ainda houver versão provisória\n- Revisar permissões por usuário/módulo\n- Manter dashboard sem atalhos duplicados ou módulos obsoletos" },
      { name: "05 — Melhorias futuras", desc: "- Visão geral do status dos módulos\n- Administração centralizada de permissões\n- Indicadores rápidos no dashboard\n- Padronização visual entre módulos\n- Centralizar documentação técnica\n- Evitar duplicação de funções entre Portal, Drive, Trello e extensões" },
    ],
  },
  {
    aliases: ["estoque"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: PRONTO / OPERACIONAL\nData de referência: 07/08/2026\n\nSistema utilizado para consulta e operação de estoque.\n\nDecisão estrutural:\n- Planilha não é interface principal\n- URL /exec não deve ser usada como tela\n- Apps Script apenas como backend quando necessário\n- Operação atual baseada na extensão Chrome" },
      { name: "02 — Links, acessos e permissões", desc: `Portal: ${portal}\nRepositório: ${repo}\n\nPermissões atuais segundo access-control: todos os usuários cadastrados no Portal possuem acesso ao módulo Estoque.\n\nA operação deve continuar separando funções administrativas das funções de consulta sempre que necessário.` },
      { name: "03 — Status e versão atual", desc: "PRONTO / OPERACIONAL\n\nJá realizado:\n- Integração com o Portal\n- Extensão Chrome como interface operacional\n- Backend separado da interface\n- Acesso controlado pelo Portal" },
      { name: "04 — Pendências / problemas", desc: "- Registrar a versão oficial da extensão instalada\n- Garantir backup do ZIP oficial\n- Manter procedimento simples de reinstalação\n- Evitar recriar uma segunda interface de Estoque sem necessidade" },
      { name: "05 — Melhorias futuras", desc: "- Centralizar permissões\n- Criar histórico de versões da extensão\n- Documentar instalação e recuperação\n- Criar card técnico específico apenas quando houver incidente ou alteração" },
    ],
  },
  {
    aliases: ["motorista", "agenda motorista"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: PRONTO / OPERACIONAL\nData de referência: 07/08/2026\n\nSistema de agendamento e acompanhamento de viagens e entregas das lojas Araras e Rio Claro.\n\nDuas interfaces distintas:\n1. Equipe: cria, edita, agenda, consulta e imprime.\n2. Motorista: somente leitura, interface simplificada e foco em celular/rota." },
      { name: "02 — Links, acessos e permissões", desc: `Equipe: ${portal}/dashboard/motorista\nMotorista: ${portal}/motorista\nPlanilha: https://docs.google.com/spreadsheets/d/1vDLItnvuqeC75q01z9pEbOPNjfbfRs_ISyPHOq8GCyo/edit?usp=drive_link\nModelo impressão: https://docs.google.com/document/d/1fu5E6sJtYPNoaaRJVCtQuevpS-7ynexeBaJixjCkihU/edit?usp=drive_link\n\nPermissões atuais no Portal: Ciça, Marcelo, Margareth, Jeovana, Estoque Araras, Carolina Araras, Jaqueline e Thais.\nTela do motorista: somente leitura e sem senha adicional da aplicação.` },
      { name: "03 — Status e versão atual", desc: "PRONTO / OPERACIONAL\n\nJá realizado:\n- Tela de agendamento da equipe\n- Tela separada para motorista\n- Araras e Rio Claro na mesma leitura do motorista\n- Rota\n- Impressão\n- Cadastro e edição\n- Visualização Dia com opção Mês\n- Remoção de botões Duplicar e Excel" },
      { name: "04 — Pendências / problemas", desc: "- Validar impressão de todas as entregas do dia\n- Acompanhar uso real no celular\n- Manter separados Vendedor e Preenchido por\n- Confirmar comportamento de eventos concluídos e históricos quando aplicável" },
      { name: "05 — Melhorias futuras", desc: "- Indicador de viagem concluída\n- Registro de usuário que criou/alterou a viagem\n- Melhorias de impressão diária\n- Revisão contínua da experiência mobile sem adicionar complexidade ao motorista" },
    ],
  },
  {
    aliases: ["reunioes", "reuniao", "reuniões"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: PRONTO\nData de referência: 07/08/2026\n\nOrganização das reuniões de resultados de Araras e Rio Claro com estrutura baseada em Google Drive, Docs, Slides e Agenda Ciça.\n\nNão necessita de módulo operacional complexo no Portal neste momento." },
      { name: "02 — Links, acessos e permissões", desc: "Pauta: https://docs.google.com/document/d/1NoZASmMc-ptrqFy8zbvtGgCJjLJxX8GsORM-F4N799k/edit\nApresentação: https://docs.google.com/presentation/d/1AK7mw2-ifR-ChlRuun_4O9FIr3ThmZvzfVMA_ryZgXA/edit\nAta/modelo: https://docs.google.com/document/d/1S9dQlOGwFE8RwNnjw1PFy08DH9a6k1_9kugQEBgmxHQ/edit\n\nEstrutura Drive: REUNIÕES / 2026 / ARARAS e REUNIÕES / 2026 / RIO CLARO\n\nPermissões atuais do módulo no Portal: Ciça, Marcelo e Margareth." },
      { name: "03 — Status e versão atual", desc: "PRONTO\n\nPróximas reuniões registradas:\nRIO CLARO: 08/08/2026 e 03/09/2026 às 7h30\nARARAS: 08/09/2026 às 7h40 e 09/10/2026\n\nRegra: manter sempre visíveis as duas próximas reuniões de cada unidade." },
      { name: "04 — Pendências / problemas", desc: "- Finalizar ata e assinaturas após cada reunião\n- Manter agenda futura atualizada\n- Evitar duplicidade de documentos\n- Preservar separação por unidade e ano" },
      { name: "05 — Melhorias futuras", desc: "- Criar ata automaticamente a partir da reunião anterior\n- Automatizar criação das próximas datas\n- Lembrete para finalizar ata e colher assinaturas\n- Criar histórico anual por unidade" },
    ],
  },
  {
    aliases: ["agenda cica", "agenda ciça", "agenda"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: OPERACIONAL / EM FINALIZAÇÃO\n\nAgenda pessoal e administrativa dentro do Portal Timoni para compromissos, reuniões, consultorias, tarefas e prazos." },
      { name: "02 — Links, acessos e permissões", desc: `Acesso: ${portal}/agenda\n\nPermissões atuais no Portal: Ciça e Margareth. Marcelo não possui acesso à Agenda Ciça no access-control atual.` },
      { name: "03 — Status e versão atual", desc: "Já realizado:\n- Integração com Google Calendar\n- Próximos 7 eventos a partir de hoje\n- Visualizações mês e ano\n- Criar, editar e cancelar compromissos\n- Reuniões e consultorias integradas" },
      { name: "04 — Pendências / problemas", desc: "- Eventos concluídos devem sair da lista principal\n- Permanecer visíveis ao consultar períodos anteriores\n- Revisar sincronização após mudanças do Google Calendar" },
      { name: "05 — Melhorias futuras", desc: "- Melhorar histórico de concluídos sem poluir a tela atual\n- Manter os próximos 7 eventos como padrão\n- Evitar duplicidade entre Agenda Ciça e Agenda/Motorista" },
    ],
  },
  {
    aliases: ["compras"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: EM DESENVOLVIMENTO\n\nFluxo estratégico de compras com Trello, extensão Chrome e conferência, priorizando velocidade, redução de erros e acompanhamento dos pedidos." },
      { name: "02 — Links, acessos e permissões", desc: `Trello Compras: https://trello.com/b/UfPrTr1H/compras\nPortal: ${portal}\nRepositório: ${repo}\n\nPermissões atuais no Portal: Ciça, Marcelo e Margareth.` },
      { name: "03 — Status e versão atual", desc: "Já realizado:\n- Integração Trello no Portal\n- Extensão Chrome\n- Regras de fornecedores e pedidos urgentes\n- Organização dos cards\n- Leitura de itens de planilha\n- Preparação da conferência\n- Regras de atualização de pedido" },
      { name: "04 — Pendências / problemas", desc: "- Consolidar ZIP oficial da extensão\n- Validar definitivamente filtro das planilhas\n- Finalizar integração da conferência\n- Garantir estabilidade da abertura de cards do Trello\n- Criar backup da versão oficial" },
      { name: "05 — Melhorias futuras", desc: "- Reduzir etapas manuais\n- Manter processo diário dentro do limite operacional definido\n- Aumentar rastreabilidade sem transformar o fluxo em burocracia\n- Integrar conferência de forma direta ao pedido" },
    ],
  },
  {
    aliases: ["conferencia", "conferência"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: EM DESENVOLVIMENTO\n\nComparação automática entre pedido interno e documento do fornecedor para eliminar erros antes da aprovação da compra." },
      { name: "02 — Links, acessos e permissões", desc: `Portal: ${portal}\nRepositório: ${repo}\n\nPermissões atuais no Portal: Ciça, Marcelo e Margareth.` },
      { name: "03 — Status e versão atual", desc: "Já definido:\n- Comparação pedido interno x fornecedor\n- Divergência de preço em amarelo\n- Demais divergências em laranja\n- Geração de Excel no padrão definido\n- Processo orientado a reduzir conferência manual" },
      { name: "04 — Pendências / problemas", desc: "- Integrar definitivamente à extensão de Compras\n- Fixar planilha-modelo\n- Automatizar nome do arquivo final\n- Testar com fornecedores e formatos diferentes" },
      { name: "05 — Melhorias futuras", desc: "- Tornar a análise automática e direta\n- Exibir somente divergências relevantes\n- Reduzir tempo de aprovação\n- Manter padrão único de saída" },
    ],
  },
  {
    aliases: ["marketing"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: ESTRUTURA DEFINIDA / FORA DO PORTAL\n\nMarketing orientado a vendas e resultados, com estratégias diferentes para Rio Claro e Araras. Consultor atual: Bruno." },
      { name: "02 — Links, acessos e permissões", desc: "Trello: https://trello.com/b/6HcTFpSp/ct-marketing\nDrive: https://drive.google.com/drive/folders/1zSvHeO4YmWOSRp4i_CBTSxleBBIzfdPD\nWhatsApp: https://chat.whatsapp.com/KpDNo1RZOsV2cvb3qEB3py\n\nPermissões atuais no Portal: Ciça e Marcelo.\nDecisão: Marketing permanece fora do Portal operacionalmente por enquanto." },
      { name: "03 — Status e versão atual", desc: "Já realizado:\n- Encerramento da Agência Santis\n- Novo consultor Bruno\n- Reuniões quinzenais a partir de 06/08/2026 às 15h30\n- Trello, Drive e grupo WhatsApp definidos" },
      { name: "04 — Pendências / problemas", desc: "- Manter reuniões quinzenais\n- Registrar campanhas e decisões no Trello\n- Conectar ações de marketing a vendas e produtos\n- Não duplicar o fluxo dentro do Portal" },
      { name: "05 — Melhorias futuras", desc: "- Criar visão resumida no Portal somente se gerar ganho operacional\n- Medir campanhas por vendas e resultado\n- Separar estratégias de Rio Claro e Araras" },
    ],
  },
  {
    aliases: ["financeiro"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: A DEFINIR / NÃO IMPLEMENTADO COMO MÓDULO FINAL\n\nO módulo financeiro ainda precisa de definição funcional antes de expansão para evitar desenvolver uma interface sem processo consolidado." },
      { name: "02 — Links, acessos e permissões", desc: `Portal: ${portal}\n\nPermissões atuais no Portal: Ciça, Marcelo, Margareth, Carolina - Financeiro Rio Claro, Jeovana e Estoque Araras.` },
      { name: "03 — Status e versão atual", desc: "Já realizado:\n- Módulo previsto no Portal\n- Perfis de acesso já definidos no access-control\n\nAinda falta definir claramente objetivo, fonte dos dados, indicadores e relatórios." },
      { name: "04 — Pendências / problemas", desc: "Antes de desenvolver:\n- Definir objetivo do módulo\n- Definir dados e origem\n- Definir usuários\n- Definir indicadores\n- Definir relatórios\n- Confirmar necessidade real de integração" },
      { name: "05 — Melhorias futuras", desc: "Desenvolver somente após o fluxo financeiro estar definido. Priorizar consulta e decisão; evitar replicar sistemas financeiros já existentes." },
    ],
  },
  {
    aliases: ["tela de inicio cica", "tela inicial cica", "inicio cica", "início ciça"],
    cards: [
      { name: "01 — Descrição e objetivo", desc: "STATUS: EM AJUSTE\n\nTela operacional principal da Ciça para concentrar atalhos e acesso rápido aos módulos do Portal Timoni." },
      { name: "02 — Links, acessos e permissões", desc: `Portal: ${portal}\n\nAcesso principal: Ciça.\nA navegação global deve respeitar as permissões individuais de cada módulo.` },
      { name: "03 — Status e versão atual", desc: "Já definido:\n- Atalhos para módulos\n- Navegação superior\n- Acesso rápido aos sistemas principais" },
      { name: "04 — Pendências / problemas", desc: "- Garantir botão de troca de tela em todas as páginas\n- Remover atalhos duplicados\n- Manter somente informações realmente úteis para a operação diária" },
      { name: "05 — Melhorias futuras", desc: "- Evoluir para painel pessoal de prioridades sem virar uma nova lista de tarefas\n- Exibir apenas indicadores e atalhos que gerem ação" },
    ],
  },
];

function listMatches(name: string, aliases: string[]) {
  const normalized = normalizeTrelloText(name);
  return aliases.some((alias) => {
    const a = normalizeTrelloText(alias);
    return normalized === a || normalized.includes(a);
  });
}

export async function POST() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (email !== "mcrodini@gmail.com") {
    return NextResponse.json({ error: "Apenas Ciça pode executar esta organização." }, { status: 403 });
  }

  const credentials = await getStoredTrelloCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Trello ainda não configurado neste navegador." }, { status: 400 });
  }

  try {
    const board = await trelloFetch<TrelloBoard>(`/boards/${BOARD}`, {
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
    const result = { board: board.name, created: [] as string[], updated: [] as string[], missingLists: [] as string[] };

    for (const spec of specs) {
      const list = lists.find((item) => listMatches(item.name, spec.aliases));
      if (!list) {
        result.missingLists.push(spec.aliases[0]);
        continue;
      }

      for (let index = 0; index < spec.cards.length; index += 1) {
        const wanted = spec.cards[index];
        const existing = cards.find(
          (card) => card.idList === list.id && normalizeTrelloText(card.name) === normalizeTrelloText(wanted.name),
        );
        const pos = (index + 1) * 16384;

        if (existing) {
          await trelloFetch(`/cards/${existing.id}`, {
            method: "PUT",
            params: { name: wanted.name, desc: wanted.desc, idList: list.id, pos },
          });
          result.updated.push(`${list.name} / ${wanted.name}`);
        } else {
          await trelloFetch("/cards", {
            method: "POST",
            params: { idList: list.id, name: wanted.name, desc: wanted.desc, pos },
          });
          result.created.push(`${list.name} / ${wanted.name}`);
        }
      }
    }

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível organizar o Trello." },
      { status: 502 },
    );
  }
}
