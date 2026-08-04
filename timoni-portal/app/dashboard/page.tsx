import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasModuleAccess, type PortalModule } from "@/lib/access-control";

const modules: Array<{module:PortalModule;name:string;description:string;href:string;icon:string;external?:boolean;accent:string}> = [
  {module:"painel",name:"Painel Timoni",description:"Comunicados, reuniões, aniversários, férias e orientações da equipe.",href:"/colaboradores",icon:"📢",accent:"border-indigo-200 bg-indigo-50"},
  {module:"agenda",name:"Agenda da Ciça",description:"Compromissos, reuniões e atividades organizadas por data.",href:"/agenda",icon:"📅",accent:"border-violet-200 bg-violet-50"},
  {module:"compras",name:"Compras",description:"Pedidos, pendências, fornecedores e acompanhamento das compras.",href:"/dashboard/compras",icon:"🛒",accent:"border-blue-200 bg-blue-50"},
  {module:"conferencia",name:"Conferência de pedidos",description:"Comparação de documentos e conferência das informações de compra.",href:"/dashboard/conferencia-pedidos",icon:"✅",accent:"border-cyan-200 bg-cyan-50"},
  {module:"estoque",name:"Estoque",description:"Consulta de produtos, necessidades e acompanhamento das solicitações.",href:"/dashboard/estoque",icon:"📦",accent:"border-emerald-200 bg-emerald-50"},
  {module:"motorista",name:"Agenda Motorista",description:"Entregas, retiradas, viagens e organização das rotas.",href:"https://mcrodini-hub.github.io/portaltimoni/agenda-motorista/",icon:"🚚",external:true,accent:"border-amber-200 bg-amber-50"},
  {module:"reunioes",name:"Reuniões",description:"Pautas, decisões, atas e pendências de acompanhamento.",href:"/dashboard/reunioes",icon:"👥",accent:"border-rose-200 bg-rose-50"},
  {module:"marketing",name:"Marketing",description:"Campanhas, conteúdo, materiais e comunicação da Casa Timoni.",href:"/dashboard/marketing",icon:"📣",accent:"border-pink-200 bg-pink-50"},
  {module:"financeiro",name:"Financeiro",description:"Pagamentos, atrasos, devoluções e bonificações de fornecedores.",href:"/dashboard/financeiro",icon:"💰",accent:"border-lime-200 bg-lime-50"},
];

export default async function DashboardPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const visible = modules.filter((item) => hasModuleAccess(email, item.module));

  return (
    <div className="pb-4">
      <header className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">Casa Timoni</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Portal Timoni</h1>
        <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-600">Acesso centralizado aos módulos de trabalho e comunicação interna.</p>
      </header>

      <section>
        <div className="flex justify-end">
          <p className="text-xs text-slate-500">{visible.length} {visible.length === 1 ? "módulo disponível" : "módulos disponíveis"}</p>
        </div>

        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => {
            const className = `group rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.accent}`;
            const content = <>
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm">{item.icon}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 shadow-sm">Ativo</span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-950">{item.name}</h3>
              <p className="mt-1 min-h-9 overflow-hidden text-sm leading-5 text-slate-600 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{item.description}</p>
              <p className="mt-3 text-xs font-semibold text-blue-800">Acessar módulo →</p>
            </>;
            return item.external ? <a key={item.name} href={item.href} target="_blank" rel="noreferrer" className={className}>{content}</a> : <Link key={item.name} href={item.href} className={className}>{content}</Link>;
          })}
        </div>
      </section>

      <footer className="mt-5 border-t border-slate-200 pt-3 text-center text-[11px] text-slate-400">
        Idealizado por Ciça Rodini para fortalecer a comunicação interna e a evolução dos processos da Casa Timoni. Agosto 2026
      </footer>
    </div>
  );
}
