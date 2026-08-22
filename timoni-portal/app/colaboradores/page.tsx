import { auth } from "@/lib/auth";
import { listEventsInRange } from "@/lib/google-calendar";
import type { CalendarEventDTO } from "@/lib/types";
import ComunicadosFeed from "@/app/colaboradores/comunicados-feed";
import ComunicadosAdmin from "@/app/colaboradores/comunicados-admin";

type PanelStore = "geral" | "rio claro" | "araras";
type Store = "rio claro" | "araras";
type FixedMeeting = { summary: string; start: string; label: string };
type PanelDateItem = { id: string; summary: string; start: string; end?: string };

function normalizeText(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function getPanelStore(email:string):PanelStore{const e=email.trim().toLowerCase();if(["mcrodini@gmail.com","mrodini@gmail.com"].includes(e))return "geral";if(["estoqueararascasatimoni@gmail.com","comercialara@casatimoni.com.br","fotoscasatimoni@gmail.com","reginaldo@casatimoni.com.br","casatimoniararas@gmail.com"].includes(e))return "araras";return "rio claro"}
function parseEventDate(value:string){return new Date(value.includes("T")?value:`${value}T12:00:00-03:00`)}
function formatDate(value:string|Date){const d=typeof value==="string"?parseEventDate(value):value;return new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric"}).format(d)}
function formatMeeting(m:FixedMeeting){const d=parseEventDate(m.start);const time=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit"}).format(d);return `${formatDate(d)} · ${time}`}
function isBirthday(e:CalendarEventDTO){const t=normalizeText(e.summary);return t.includes("aniversario")||t.includes("aniversariante")||t.includes("birthday")}
function isVacation(e:CalendarEventDTO){return normalizeText(e.summary).includes("ferias")}
function panelItem(e:CalendarEventDTO):PanelDateItem{return{id:`${e.calendarKey}-${e.id}`,summary:e.summary,start:e.start,end:e.end}}
function cleanSummary(s:string){return s.replace(/^anivers[aá]rio\s*/i,"").replace(/\s*-\s*f[eé]rias\s*$/i,"").trim()}
function unique(items:PanelDateItem[],limit=6){const seen=new Set<string>();return items.sort((a,b)=>parseEventDate(a.start).getTime()-parseEventDate(b.start).getTime()).filter(i=>{const k=`${normalizeText(cleanSummary(i.summary))}-${formatDate(i.start)}`;if(seen.has(k))return false;seen.add(k);return true}).slice(0,limit)}

const fixedMeetingSchedule:Record<Store,FixedMeeting[]>={
 araras:[{summary:"Reunião Araras",start:"2026-09-08T07:40:00-03:00",label:"Próxima"},{summary:"Reunião Araras",start:"2026-10-09T07:40:00-03:00",label:"Seguinte"}],
 "rio claro":[{summary:"Reunião Rio Claro",start:"2026-09-03T07:30:00-03:00",label:"Próxima"},{summary:"Reunião Rio Claro",start:"2026-10-03T07:30:00-03:00",label:"Seguinte"}]
};
function meetings(now:Date,unit:Store){return fixedMeetingSchedule[unit].filter(m=>new Date(parseEventDate(m.start).getTime()+3600000)>now).slice(0,2)}
const fixedBirthdays:PanelDateItem[]=[{id:"reinaldo-araras",summary:"Reinaldo (Araras)",start:"2026-08-13"},{id:"thais",summary:"Thais",start:"2026-08-19"},{id:"maria-carolina-araras",summary:"Maria Carolina (Araras)",start:"2026-08-30"},{id:"joao-aniversario-loja",summary:"João aniversário de loja",start:"2026-09-01"}];
const fixedVacations:PanelDateItem[]=[{id:"leopoldo",summary:"Leopoldo",start:"2026-08-03",end:"2026-08-23"}];
function AnnouncementCard({store,isAdmin}:{store:Store;isAdmin:boolean}){return <article className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Comunicados</p><h2 className="mt-2 text-xl font-semibold text-slate-950">{store==="rio claro"?"Rio Claro":"Araras"}</h2><div className="mt-4 space-y-4"><ComunicadosFeed store={store} isAdmin={isAdmin}/></div></article>}
function MeetingSummaryCard({araras,rioClaro}:{araras:FixedMeeting[];rioClaro:FixedMeeting[]}){const unit=(title:string,list:FixedMeeting[])=><div><h3 className="font-semibold text-slate-950">{title}</h3>{list.length?<div className="mt-2 space-y-2">{list.map((m,i)=><div key={m.start} className="rounded-xl bg-white/70 p-3"><p className="text-xs font-semibold uppercase text-violet-700">{i===0?"Próxima":"Seguinte"}</p><p className="mt-1 text-sm font-semibold text-slate-800">{formatMeeting(m)}</p></div>)}</div>:<p className="mt-2 text-sm text-slate-500">Nenhuma reunião programada.</p>}</div>;return <article className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Reuniões</p><div className="mt-3 space-y-4">{unit("Rio Claro",rioClaro)}<div className="border-t border-violet-200 pt-4">{unit("Araras",araras)}</div></div></article>}
function EventCard({title,tone,events}:{title:string;tone:"pink"|"amber";events:PanelDateItem[]}){const cls=tone==="pink"?"border-pink-200 bg-pink-50":"border-amber-200 bg-amber-50";return <article className={`rounded-3xl border p-5 shadow-sm ${cls}`}><p className="text-xs font-semibold uppercase tracking-wider text-slate-700">{title}</p>{events.length?<ul className="mt-3 space-y-2">{events.map(e=><li key={e.id} className="rounded-xl bg-white/70 p-3"><p className="font-semibold text-slate-900">{cleanSummary(e.summary)}</p><p className="mt-1 text-sm text-slate-600">{title==="Férias"&&e.end?`${formatDate(e.start)} a ${formatDate(e.end)}`:formatDate(e.start)}</p></li>)}</ul>:<p className="mt-3 text-sm text-slate-500">Nenhum registro informado.</p>}</article>}

export default async function ColaboradoresPage(){
 const session=await auth();const email=session?.user?.email??"";const normalized=email.trim().toLowerCase();const panelStore=getPanelStore(email);const isCica=normalized==="mcrodini@gmail.com";const now=new Date();let events:CalendarEventDTO[]=[];
 if(session?.accessToken&&session.error!=="RefreshAccessTokenError"){try{const min=new Date(now);min.setDate(min.getDate()-45);const max=new Date(now);max.setFullYear(max.getFullYear()+1);events=(await listEventsInRange(session.accessToken,{timeMin:min.toISOString(),timeMax:max.toISOString(),maxResults:500})).filter(e=>e.calendarKey==="timoni")}catch{events=[]}}
 const araras=meetings(now,"araras"),rioClaro=meetings(now,"rio claro");
 const birthdays=unique([...fixedBirthdays,...events.filter(isBirthday).filter(e=>parseEventDate(e.start)>=now).map(panelItem)]);
 const vacations=unique([...fixedVacations,...events.filter(e=>isVacation(e)&&parseEventDate(e.end)>now).map(panelItem)]);
 return <div className="pb-10"><header className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Comunicação interna</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Painel Timoni</h1></header>
 {panelStore==="geral"?<section className="grid gap-4 lg:grid-cols-2"><AnnouncementCard store="rio claro" isAdmin={isCica}/><AnnouncementCard store="araras" isAdmin={isCica}/><div className="lg:col-span-2"><MeetingSummaryCard araras={araras} rioClaro={rioClaro}/></div><EventCard title="Aniversários" tone="pink" events={birthdays}/><EventCard title="Férias" tone="amber" events={vacations}/></section>:<section className="grid gap-4 lg:grid-cols-2"><AnnouncementCard store={panelStore} isAdmin={isCica}/><MeetingSummaryCard araras={panelStore==="araras"?araras:[]} rioClaro={panelStore==="rio claro"?rioClaro:[]}/><EventCard title="Aniversários" tone="pink" events={birthdays}/><EventCard title="Férias" tone="amber" events={vacations}/></section>}
 {isCica&&<ComunicadosAdmin/>}<p className="mt-10 text-center text-xs text-slate-400">Idealizado por Ciça Rodini para fortalecer a comunicação interna da Casa Timoni.</p></div>
}
